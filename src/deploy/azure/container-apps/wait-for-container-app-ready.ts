/**
 * Wait for Container App Ready
 *
 * Polls a Container App until its provisioning state is "Succeeded".
 */

import { ContainerAppsAPIClient } from '@azure/arm-appcontainers';
import type { InfraCoreRuntime } from '../../../types/runtime.ts';
import type { AzureCredentials } from '../../../types/credentials.ts';
import { createAzureCredential } from '../create-azure-credential.ts';
import { InfraCoreError } from '../../../runtime/infra-core-error.ts';

export interface WaitForContainerAppReadyOptions {
  credentials: AzureCredentials;
  resourceGroupName: string;
  containerAppName: string;
  /** Timeout in milliseconds (default: 300000 = 5 minutes) */
  timeoutMs?: number;
  /** Poll interval in milliseconds (default: 10000 = 10 seconds) */
  pollIntervalMs?: number;
}

export interface WaitForContainerAppReadyResult {
  status: string;
}

export async function waitForContainerAppReady(
  runtime: InfraCoreRuntime,
  options: WaitForContainerAppReadyOptions,
): Promise<WaitForContainerAppReadyResult> {
  const {
    credentials,
    resourceGroupName,
    containerAppName,
    timeoutMs = 300000,
    pollIntervalMs = 10000,
  } = options;

  const credential = createAzureCredential(runtime, credentials);

  const client = new ContainerAppsAPIClient(
    credential,
    credentials.subscriptionId,
  );

  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    try {
      const app = await client.containerApps.get(
        resourceGroupName,
        containerAppName,
      );

      const status = app.provisioningState ?? 'Unknown';

      if (status === 'Succeeded') {
        return { status };
      }

      if (status === 'Failed' || status === 'Canceled') {
        throw new InfraCoreError(
          `Container App reached ${status} state`,
          'container-app-deploy',
          'Check Azure Portal for deployment details',
        );
      }

      // Still provisioning, wait and poll again
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    } catch (err: unknown) {
      if (err instanceof InfraCoreError) throw err;
      throw new InfraCoreError(
        'Error polling Container App status',
        'container-app-deploy',
        err instanceof Error ? err.message : 'Unknown error',
      );
    }
  }

  throw new InfraCoreError(
    `Timeout waiting for Container App to be ready (${timeoutMs}ms)`,
    'container-app-deploy',
    'Consider increasing the timeout or checking Azure Portal for issues',
  );
}
