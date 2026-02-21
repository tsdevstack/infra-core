/**
 * Update ECS Service
 *
 * Forces a new deployment of an ECS service using the latest task definition.
 * This triggers ECS to pull the latest image and deploy new tasks.
 */

import { ECSClient, UpdateServiceCommand } from '@aws-sdk/client-ecs';
import type { InfraCoreRuntime } from '../../../types/runtime.ts';
import type { AWSCredentials } from '../../../types/credentials.ts';
import { InfraCoreError } from '../../../runtime/infra-core-error.ts';

export interface UpdateEcsServiceOptions {
  credentials: AWSCredentials;
  clusterName: string;
  serviceName: string;
  /** Force new deployment even if task definition hasn't changed */
  forceNewDeployment?: boolean;
  /** Specific task definition ARN to deploy (optional) */
  taskDefinitionArn?: string;
}

export interface UpdateEcsServiceResult {
  deploymentId?: string;
}

/**
 * Update an ECS service to trigger a new deployment
 */
export async function updateEcsService(
  runtime: InfraCoreRuntime,
  options: UpdateEcsServiceOptions,
): Promise<UpdateEcsServiceResult> {
  const {
    credentials,
    clusterName,
    serviceName,
    forceNewDeployment = true,
    taskDefinitionArn,
  } = options;

  // Build ECS client config
  const clientConfig: {
    region: string;
    credentials?: { accessKeyId: string; secretAccessKey: string };
  } = {
    region: credentials.region,
  };

  // Only set explicit credentials in local mode
  if (!runtime.isCIEnv()) {
    clientConfig.credentials = {
      accessKeyId: credentials.accessKeyId,
      secretAccessKey: credentials.secretAccessKey,
    };
  }

  const ecs = new ECSClient(clientConfig);

  try {
    // Update service with force new deployment
    const updateResponse = await ecs.send(
      new UpdateServiceCommand({
        cluster: clusterName,
        service: serviceName,
        forceNewDeployment,
        ...(taskDefinitionArn && { taskDefinition: taskDefinitionArn }),
      }),
    );

    // Get the latest deployment ID
    const deploymentId = updateResponse.service?.deployments?.[0]?.id;

    return { deploymentId };
  } catch (err: unknown) {
    throw new InfraCoreError(
      'Failed to update ECS service',
      'ecs-deploy',
      err instanceof Error ? err.message : 'Unknown error',
    );
  }
}
