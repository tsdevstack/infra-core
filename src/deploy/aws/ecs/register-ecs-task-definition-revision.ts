/**
 * Register the next revision of an ECS task definition family
 */

import {
  ECSClient,
  DescribeTaskDefinitionCommand,
  RegisterTaskDefinitionCommand,
} from '@aws-sdk/client-ecs';
import type { InfraCoreRuntime } from '../../../types/runtime.ts';
import type { AWSCredentials } from '../../../types/credentials.ts';
import { InfraCoreError } from '../../../runtime/infra-core-error.ts';

export interface RegisterEcsTaskDefinitionRevisionOptions {
  credentials: AWSCredentials;
  /** The family; its latest ACTIVE revision is the base */
  family: string;
  imageUri: string;
  /** Set over the environment the base revision has (name → value) */
  environment?: Record<string, string>;
  /** The container's secrets (env var name → Secrets Manager ARN), in place of the base's */
  secrets?: Record<string, string>;
}

export interface RegisterEcsTaskDefinitionRevisionResult {
  taskDefinitionArn: string;
  /** The container's name (the base revision's) */
  containerName: string;
}

/**
 * The latest revision with the image, the environment and the secrets
 * replaced: CPU, memory, roles, command and logging stay as the family has
 * them (Terraform's settings), and so do its tags.
 *
 * @returns undefined when the family has no ACTIVE revision (never applied)
 * @throws InfraCoreError when the revision can't be read or registered
 */
export async function registerEcsTaskDefinitionRevision(
  runtime: InfraCoreRuntime,
  options: RegisterEcsTaskDefinitionRevisionOptions,
): Promise<RegisterEcsTaskDefinitionRevisionResult | undefined> {
  const { credentials, family, imageUri } = options;
  const ecs = new ECSClient(
    runtime.isCIEnv()
      ? { region: credentials.region }
      : {
          region: credentials.region,
          credentials: {
            accessKeyId: credentials.accessKeyId,
            secretAccessKey: credentials.secretAccessKey,
          },
        },
  );

  let described;
  try {
    described = await ecs.send(
      new DescribeTaskDefinitionCommand({
        taskDefinition: family,
        include: ['TAGS'],
      }),
    );
  } catch (error) {
    // A family without an ACTIVE revision: "Unable to describe task definition"
    if ((error as { name?: string } | null)?.name === 'ClientException') {
      return undefined;
    }
    throw new InfraCoreError(
      `Failed to read task definition ${family}`,
      'ecs-deploy',
      error instanceof Error ? error.message : 'Unknown error',
      { cause: error },
    );
  }

  const base = described.taskDefinition;
  const container = base?.containerDefinitions?.[0];
  if (!base || !container?.name) {
    throw new InfraCoreError(
      `Task definition ${family} has no container`,
      'ecs-deploy',
      'Check that Terraform created the task definition',
    );
  }

  const environment = [
    ...(container.environment ?? []).filter(
      (entry) =>
        entry.name === undefined ||
        !(options.environment && entry.name in options.environment),
    ),
    ...Object.entries(options.environment ?? {}).map(([name, value]) => ({
      name,
      value,
    })),
  ];
  const secrets = Object.entries(options.secrets ?? {}).map(
    ([name, valueFrom]) => ({ name, valueFrom }),
  );

  try {
    const registered = await ecs.send(
      new RegisterTaskDefinitionCommand({
        family: base.family ?? family,
        networkMode: base.networkMode,
        requiresCompatibilities: base.requiresCompatibilities,
        cpu: base.cpu,
        memory: base.memory,
        executionRoleArn: base.executionRoleArn,
        taskRoleArn: base.taskRoleArn,
        containerDefinitions: [
          {
            ...container,
            image: imageUri,
            environment,
            secrets: secrets.length > 0 ? secrets : undefined,
          },
        ],
        tags:
          described.tags && described.tags.length > 0
            ? described.tags
            : undefined,
      }),
    );
    const taskDefinitionArn = registered.taskDefinition?.taskDefinitionArn;
    if (!taskDefinitionArn) {
      throw new Error('No task definition ARN returned');
    }
    return { taskDefinitionArn, containerName: container.name };
  } catch (error) {
    throw new InfraCoreError(
      `Failed to register a revision of ${family}`,
      'ecs-deploy',
      error instanceof Error ? error.message : 'Unknown error',
      { cause: error },
    );
  }
}
