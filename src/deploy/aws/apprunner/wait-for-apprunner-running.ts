/**
 * Wait for App Runner Service to be Running
 *
 * Polls the App Runner service until status is RUNNING.
 */

import {
  AppRunnerClient,
  DescribeServiceCommand,
  ServiceStatus,
} from '@aws-sdk/client-apprunner';
import type { InfraCoreRuntime } from '../../../types/runtime.ts';
import type { AWSCredentials } from '../../../types/credentials.ts';
import { InfraCoreError } from '../../../runtime/infra-core-error.ts';

export interface WaitForAppRunnerRunningOptions {
  credentials: AWSCredentials;
  serviceArn: string;
  /** Max wait time in ms (default: 10 minutes - App Runner can be slow) */
  timeoutMs?: number;
  /** Poll interval in ms (default: 15 seconds) */
  pollIntervalMs?: number;
  /** Optional callback for status updates */
  onStatusUpdate?: (status: string) => void;
}

export interface WaitForAppRunnerRunningResult {
  status: ServiceStatus;
  serviceUrl?: string;
}

/**
 * Wait for an App Runner service to reach RUNNING status
 */
export async function waitForAppRunnerRunning(
  runtime: InfraCoreRuntime,
  options: WaitForAppRunnerRunningOptions,
): Promise<WaitForAppRunnerRunningResult> {
  const {
    credentials,
    serviceArn,
    timeoutMs = 600000, // 10 minutes (App Runner can be slow)
    pollIntervalMs = 15000, // 15 seconds
    onStatusUpdate,
  } = options;

  // Build App Runner client config
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

  const appRunner = new AppRunnerClient(clientConfig);
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    try {
      const response = await appRunner.send(
        new DescribeServiceCommand({
          ServiceArn: serviceArn,
        }),
      );

      const service = response.Service;
      if (!service) {
        throw new InfraCoreError(
          'App Runner service not found',
          'apprunner-deploy',
          'Ensure the service ARN is correct',
        );
      }

      const status = service.Status;

      // Report status
      if (onStatusUpdate) {
        onStatusUpdate(`Status: ${status}`);
      }

      // Check for terminal states
      if (status === ServiceStatus.RUNNING) {
        return {
          status,
          serviceUrl: service.ServiceUrl,
        };
      }

      if (
        status === ServiceStatus.CREATE_FAILED ||
        status === ServiceStatus.DELETE_FAILED ||
        status === ServiceStatus.DELETED
      ) {
        throw new InfraCoreError(
          `App Runner service reached terminal state: ${status}`,
          'apprunner-deploy',
          'Check AWS Console for deployment logs',
        );
      }

      // Still in progress (OPERATION_IN_PROGRESS, PAUSED, etc.)
      // Wait before next poll
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    } catch (err: unknown) {
      if (err instanceof InfraCoreError) throw err;
      throw new InfraCoreError(
        'Error checking App Runner service status',
        'apprunner-deploy',
        err instanceof Error ? err.message : 'Unknown error',
      );
    }
  }

  throw new InfraCoreError(
    'Timeout waiting for App Runner service to reach RUNNING status',
    'apprunner-deploy',
    `Service did not reach RUNNING status within ${timeoutMs}ms`,
  );
}
