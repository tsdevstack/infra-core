/**
 * Create or Update App Runner Service
 *
 * Creates a new App Runner service or updates an existing one.
 * App Runner services are used for Next.js applications.
 *
 * Supports both plaintext env vars (RuntimeEnvironmentVariables) and
 * dynamic secrets (RuntimeEnvironmentSecrets) that reference Secrets Manager ARNs.
 *
 * Note: App Runner does NOT support scale-to-zero. Minimum instance count is 1.
 */

import {
  AppRunnerClient,
  CreateServiceCommand,
  UpdateServiceCommand,
  ListServicesCommand,
} from '@aws-sdk/client-apprunner';
import type { InfraCoreRuntime } from '../../../types/runtime.ts';
import type { AWSCredentials } from '../../../types/credentials.ts';
import { InfraCoreError } from '../../../runtime/infra-core-error.ts';

/** App Runner defaults (smallest config) */
const APP_RUNNER_DEFAULTS = {
  cpu: 256,
  memory: 512,
  port: 8080, // Match Docker container port (same as Cloud Run)
} as const;

export interface CreateOrUpdateAppRunnerServiceOptions {
  credentials: AWSCredentials;
  /** Service name (e.g., "myproject-dev-frontend") */
  serviceName: string;
  /** Full ECR image URI (e.g., 123456789.dkr.ecr.us-east-1.amazonaws.com/project/service:tag) */
  imageUri: string;
  /** IAM role ARN for ECR access (from Terraform output) */
  accessRoleArn: string;
  /** Auto-scaling configuration ARN (from Terraform output) */
  autoScalingConfigArn: string;
  /** CPU units (256, 512, 1024, 2048, 4096) - from infrastructure config */
  cpu?: number;
  /** Memory in MB (512, 1024, 2048, 3072, 4096, 6144, 8192, 10240, 12288) - from infrastructure config */
  memory?: number;
  /** Port the container listens on (default: 3000 for Next.js) */
  port?: number;
  /** Environment variables (plaintext, static config) */
  environmentVariables?: Record<string, string>;
  /** Environment secrets (env var name → Secrets Manager ARN) - resolved at container start */
  environmentSecrets?: Record<string, string>;
  /** IAM instance role ARN for runtime access (required when using environmentSecrets) */
  instanceRoleArn?: string;
}

export interface CreateOrUpdateAppRunnerServiceResult {
  serviceArn?: string;
  serviceUrl?: string;
  operationId?: string;
  /** True if service was created, false if updated */
  created: boolean;
}

/**
 * Create or update an App Runner service
 */
export async function createOrUpdateAppRunnerService(
  runtime: InfraCoreRuntime,
  options: CreateOrUpdateAppRunnerServiceOptions,
): Promise<CreateOrUpdateAppRunnerServiceResult> {
  const {
    credentials,
    serviceName,
    imageUri,
    accessRoleArn,
    autoScalingConfigArn,
    cpu = APP_RUNNER_DEFAULTS.cpu,
    memory = APP_RUNNER_DEFAULTS.memory,
    port = APP_RUNNER_DEFAULTS.port,
    environmentVariables = {},
    environmentSecrets = {},
    instanceRoleArn,
  } = options;

  // Build App Runner client config
  const clientConfig: {
    region: string;
    credentials?: { accessKeyId: string; secretAccessKey: string };
  } = {
    region: credentials.region,
  };

  // Only set explicit credentials in local mode (CI uses IAM role)
  if (!runtime.isCIEnv()) {
    clientConfig.credentials = {
      accessKeyId: credentials.accessKeyId,
      secretAccessKey: credentials.secretAccessKey,
    };
  }

  const appRunner = new AppRunnerClient(clientConfig);

  try {
    // Check if service already exists
    const listResponse = await appRunner.send(new ListServicesCommand({}));
    const existingService = listResponse.ServiceSummaryList?.find(
      (s) => s.ServiceName === serviceName,
    );

    // Convert env vars to App Runner format (empty object = undefined)
    const runtimeEnvVars =
      Object.keys(environmentVariables).length > 0
        ? environmentVariables
        : undefined;

    // Convert secrets to App Runner format (empty object = undefined)
    const runtimeEnvSecrets =
      Object.keys(environmentSecrets).length > 0
        ? environmentSecrets
        : undefined;

    // Instance configuration - include instance role when secrets are used
    const instanceConfig: {
      Cpu: string;
      Memory: string;
      InstanceRoleArn?: string;
    } = {
      Cpu: String(cpu),
      Memory: String(memory),
    };
    if (instanceRoleArn) {
      instanceConfig.InstanceRoleArn = instanceRoleArn;
    }

    if (existingService) {
      // Update existing service
      const updateResponse = await appRunner.send(
        new UpdateServiceCommand({
          ServiceArn: existingService.ServiceArn,
          SourceConfiguration: {
            ImageRepository: {
              ImageIdentifier: imageUri,
              ImageRepositoryType: 'ECR',
              ImageConfiguration: {
                Port: String(port),
                RuntimeEnvironmentVariables: runtimeEnvVars,
                RuntimeEnvironmentSecrets: runtimeEnvSecrets,
              },
            },
            AuthenticationConfiguration: {
              AccessRoleArn: accessRoleArn,
            },
            AutoDeploymentsEnabled: false,
          },
          InstanceConfiguration: instanceConfig,
          AutoScalingConfigurationArn: autoScalingConfigArn,
          HealthCheckConfiguration: {
            Protocol: 'TCP',
            Interval: 10,
            Timeout: 5,
            HealthyThreshold: 1,
            UnhealthyThreshold: 5,
          },
        }),
      );

      return {
        serviceArn: updateResponse.Service?.ServiceArn,
        serviceUrl: updateResponse.Service?.ServiceUrl,
        operationId: updateResponse.OperationId,
        created: false,
      };
    } else {
      // Create new service
      const createResponse = await appRunner.send(
        new CreateServiceCommand({
          ServiceName: serviceName,
          SourceConfiguration: {
            ImageRepository: {
              ImageIdentifier: imageUri,
              ImageRepositoryType: 'ECR',
              ImageConfiguration: {
                Port: String(port),
                RuntimeEnvironmentVariables: runtimeEnvVars,
                RuntimeEnvironmentSecrets: runtimeEnvSecrets,
              },
            },
            AuthenticationConfiguration: {
              AccessRoleArn: accessRoleArn,
            },
            AutoDeploymentsEnabled: false,
          },
          InstanceConfiguration: instanceConfig,
          AutoScalingConfigurationArn: autoScalingConfigArn,
          HealthCheckConfiguration: {
            Protocol: 'TCP',
            Interval: 10,
            Timeout: 5,
            HealthyThreshold: 1,
            UnhealthyThreshold: 5,
          },
        }),
      );

      return {
        serviceArn: createResponse.Service?.ServiceArn,
        serviceUrl: createResponse.Service?.ServiceUrl,
        operationId: createResponse.OperationId,
        created: true,
      };
    }
  } catch (err: unknown) {
    throw new InfraCoreError(
      'Failed to create or update App Runner service',
      'apprunner-deploy',
      err instanceof Error ? err.message : 'Unknown error',
    );
  }
}
