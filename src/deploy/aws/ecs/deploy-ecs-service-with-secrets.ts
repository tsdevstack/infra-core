/**
 * Deploy ECS Service with Secrets Injection
 *
 * Similar to deploy-kong.ts, this function:
 * 1. Fetches the existing task definition
 * 2. Builds a secrets array for the service
 * 3. Registers a new task definition with secrets
 * 4. Updates the ECS service to use the new task definition
 *
 * This is needed because:
 * - Terraform creates task definitions BEFORE db-init runs
 * - db-init creates DATABASE_URL secrets in Secrets Manager
 * - Deployment must inject those secrets into the task definition
 */

import {
  ECSClient,
  DescribeTaskDefinitionCommand,
  RegisterTaskDefinitionCommand,
  UpdateServiceCommand,
} from '@aws-sdk/client-ecs';
import type { InfraCoreRuntime } from '../../../types/runtime.ts';
import type { AWSCredentials } from '../../../types/credentials.ts';
import { InfraCoreError } from '../../../runtime/infra-core-error.ts';

export interface DeployEcsServiceWithSecretsOptions {
  credentials: AWSCredentials;
  projectName: string;
  clusterName: string;
  serviceName: string;
  imageUri: string;
  hasDatabase: boolean;
  /** Additional secrets to inject (env var name → Secrets Manager ARN) */
  additionalSecrets?: Record<string, string>;
  /**
   * Plain environment variables set on every deploy (env var name → value),
   * over the ones the task definition already has. Terraform sets the same
   * values at creation, but the service keeps the CLI's task definitions
   * afterwards, so a new setting only reaches an existing environment here.
   */
  additionalEnvironment?: Record<string, string>;
}

export interface DeployEcsServiceWithSecretsResult {
  taskDefinitionArn: string;
  deploymentId?: string;
}

/**
 * Deploy an ECS service with secrets injected from Secrets Manager
 */
export async function deployEcsServiceWithSecrets(
  runtime: InfraCoreRuntime,
  options: DeployEcsServiceWithSecretsOptions,
): Promise<DeployEcsServiceWithSecretsResult> {
  const {
    credentials,
    projectName,
    clusterName,
    serviceName,
    imageUri,
    hasDatabase,
    additionalSecrets,
    additionalEnvironment,
  } = options;

  const region = credentials.region;
  const accountId = credentials.accountId;

  // Build ECS client config
  const clientConfig: {
    region: string;
    credentials?: { accessKeyId: string; secretAccessKey: string };
  } = {
    region,
  };

  if (!runtime.isCIEnv()) {
    clientConfig.credentials = {
      accessKeyId: credentials.accessKeyId,
      secretAccessKey: credentials.secretAccessKey,
    };
  }

  const ecs = new ECSClient(clientConfig);

  try {
    // Step 1: Fetch existing task definition
    const taskDefFamily = `${projectName}-${serviceName}`;
    const describeResponse = await ecs.send(
      new DescribeTaskDefinitionCommand({
        taskDefinition: taskDefFamily,
      }),
    );

    const existingTaskDef = describeResponse.taskDefinition;
    if (!existingTaskDef) {
      throw new InfraCoreError(
        `Task definition ${taskDefFamily} not found`,
        'ecs-deploy',
        'Ensure the ECS service and task definition exist',
      );
    }

    const existingContainer = existingTaskDef.containerDefinitions?.[0];
    if (!existingContainer) {
      throw new InfraCoreError(
        'Task definition has no container definitions',
        'ecs-deploy',
        'Check that the task definition was created correctly by Terraform',
      );
    }

    // Step 2: Build secrets array
    // Use hyphen format to match IAM policy: {project}-{service}-DATABASE_URL
    const secretsArray: Array<{ name: string; valueFrom: string }> = [];

    if (hasDatabase) {
      // DATABASE_URL secret - use hyphen format that IAM policy allows
      const dbSecretName = `${projectName}-${serviceName}-DATABASE_URL`;
      secretsArray.push({
        name: 'DATABASE_URL',
        valueFrom: `arn:aws:secretsmanager:${region}:${accountId}:secret:${dbSecretName}`,
      });
    }

    // Add additional secrets (e.g. API_URL, KONG_INTERNAL_URL for Next.js)
    if (additionalSecrets) {
      for (const [envVar, arn] of Object.entries(additionalSecrets)) {
        secretsArray.push({
          name: envVar,
          valueFrom: arn,
        });
      }
    }

    // Environment: what the task definition has, with the deploy's values on top
    const environment = [
      ...(existingContainer.environment ?? []).filter(
        (entry) =>
          entry.name === undefined ||
          !(additionalEnvironment && entry.name in additionalEnvironment),
      ),
      ...Object.entries(additionalEnvironment ?? {}).map(([name, value]) => ({
        name,
        value,
      })),
    ];

    // Step 3: Register new task definition with secrets
    runtime.logger.info(
      `  Registering task definition with ${secretsArray.length} secret(s)...`,
    );

    const registerResponse = await ecs.send(
      new RegisterTaskDefinitionCommand({
        family: existingTaskDef.family!,
        networkMode: existingTaskDef.networkMode,
        requiresCompatibilities: existingTaskDef.requiresCompatibilities,
        cpu: existingTaskDef.cpu,
        memory: existingTaskDef.memory,
        executionRoleArn: existingTaskDef.executionRoleArn,
        taskRoleArn: existingTaskDef.taskRoleArn,
        // The container as the task definition has it (ports, logging, health
        // check, a worker's command, ...), with only the image, the
        // environment and the secrets replaced
        containerDefinitions: [
          {
            ...existingContainer,
            image: imageUri,
            environment,
            secrets: secretsArray.length > 0 ? secretsArray : undefined,
          },
        ],
      }),
    );

    const newTaskDefArn = registerResponse.taskDefinition?.taskDefinitionArn;
    if (!newTaskDefArn) {
      throw new InfraCoreError(
        'Failed to register task definition',
        'ecs-deploy',
        'No task definition ARN returned from RegisterTaskDefinition',
      );
    }

    // Step 4: Update ECS service with new task definition
    const updateResponse = await ecs.send(
      new UpdateServiceCommand({
        cluster: clusterName,
        service: serviceName,
        taskDefinition: newTaskDefArn,
        forceNewDeployment: true,
      }),
    );

    const deploymentId = updateResponse.service?.deployments?.[0]?.id;

    return {
      taskDefinitionArn: newTaskDefArn,
      deploymentId,
    };
  } catch (err: unknown) {
    if (err instanceof InfraCoreError) throw err;
    throw new InfraCoreError(
      'Failed to deploy ECS service with secrets',
      'ecs-deploy',
      err instanceof Error ? err.message : 'Unknown error',
    );
  }
}
