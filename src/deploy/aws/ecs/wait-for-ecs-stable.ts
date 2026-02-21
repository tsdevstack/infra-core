/**
 * Wait for ECS Service to Stabilize
 *
 * Polls the ECS service until all tasks are running and healthy.
 */

import { ECSClient, DescribeServicesCommand } from '@aws-sdk/client-ecs';
import type { InfraCoreRuntime } from '../../../types/runtime.ts';
import type { AWSCredentials } from '../../../types/credentials.ts';
import { InfraCoreError } from '../../../runtime/infra-core-error.ts';

export interface WaitForEcsStableOptions {
  credentials: AWSCredentials;
  clusterName: string;
  serviceName: string;
  /** Max wait time in ms (default: 5 minutes) */
  timeoutMs?: number;
  /** Poll interval in ms (default: 10 seconds) */
  pollIntervalMs?: number;
  /** Optional callback for status updates */
  onStatusUpdate?: (status: string) => void;
}

export interface WaitForEcsStableResult {
  runningCount: number;
  desiredCount: number;
}

/**
 * Wait for an ECS service to become stable
 */
export async function waitForEcsStable(
  runtime: InfraCoreRuntime,
  options: WaitForEcsStableOptions,
): Promise<WaitForEcsStableResult> {
  const {
    credentials,
    clusterName,
    serviceName,
    timeoutMs = 300000, // 5 minutes
    pollIntervalMs = 10000, // 10 seconds
    onStatusUpdate,
  } = options;

  // Build ECS client config
  const clientConfig: {
    region: string;
    credentials?: { accessKeyId: string; secretAccessKey: string };
  } = {
    region: credentials.region,
  };

  if (!runtime.isCIEnv()) {
    clientConfig.credentials = {
      accessKeyId: credentials.accessKeyId,
      secretAccessKey: credentials.secretAccessKey,
    };
  }

  const ecs = new ECSClient(clientConfig);
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    try {
      const response = await ecs.send(
        new DescribeServicesCommand({
          cluster: clusterName,
          services: [serviceName],
        }),
      );

      const service = response.services?.[0];
      if (!service) {
        throw new InfraCoreError(
          `Service ${serviceName} not found`,
          'ecs-deploy',
          'Ensure the ECS service exists in the cluster',
        );
      }

      const runningCount = service.runningCount ?? 0;
      const desiredCount = service.desiredCount ?? 0;
      const pendingCount = service.pendingCount ?? 0;

      // Check if stable: running matches desired and no pending
      if (runningCount >= desiredCount && pendingCount === 0) {
        return { runningCount, desiredCount };
      }

      // Report status
      if (onStatusUpdate) {
        onStatusUpdate(
          `${serviceName}: ${runningCount}/${desiredCount} running, ${pendingCount} pending`,
        );
      }

      // Wait before next poll
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    } catch (err: unknown) {
      if (err instanceof InfraCoreError) throw err;
      throw new InfraCoreError(
        'Error checking ECS service status',
        'ecs-deploy',
        err instanceof Error ? err.message : 'Unknown error',
      );
    }
  }

  throw new InfraCoreError(
    `Timeout waiting for service ${serviceName} to stabilize`,
    'ecs-deploy',
    `Service did not stabilize within ${timeoutMs}ms`,
  );
}
