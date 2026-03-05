/**
 * Wait for Container App Activation
 *
 * Polls the latest revision's health state to verify the container
 * actually started (image pulled, container running). Unlike
 * waitForContainerAppReady (which only checks ARM provisioning state),
 * this checks replica-level health.
 *
 * Returns a result object instead of throwing, so callers can decide
 * whether to retry (e.g., for RBAC propagation delays on managed identity).
 */

import { ContainerAppsAPIClient } from '@azure/arm-appcontainers';
import type { InfraCoreRuntime } from '../../../types/runtime.ts';
import type { AzureCredentials } from '../../../types/credentials.ts';
import { createAzureCredential } from '../create-azure-credential.ts';

export interface WaitForContainerAppActivationOptions {
  credentials: AzureCredentials;
  resourceGroupName: string;
  containerAppName: string;
  /** Timeout in milliseconds (default: 300000 = 5 minutes, must exceed Azure's ~4 min activation deadline) */
  timeoutMs?: number;
  /** Poll interval in milliseconds (default: 5000 = 5 seconds) */
  pollIntervalMs?: number;
}

export interface WaitForContainerAppActivationResult {
  healthy: boolean;
  error?: string;
}

export async function waitForContainerAppActivation(
  runtime: InfraCoreRuntime,
  options: WaitForContainerAppActivationOptions,
): Promise<WaitForContainerAppActivationResult> {
  const {
    credentials,
    resourceGroupName,
    containerAppName,
    timeoutMs = 300000,
    pollIntervalMs = 5000,
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

      const latestRevisionName = app.latestRevisionName;
      if (!latestRevisionName) {
        await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
        continue;
      }

      const revision = await client.containerAppsRevisions.getRevision(
        resourceGroupName,
        containerAppName,
        latestRevisionName,
      );

      const healthState = revision.healthState;
      const runningState = revision.runningState;
      const replicas = revision.replicas ?? 0;

      if (healthState === 'Healthy' && replicas > 0) {
        return { healthy: true };
      }

      // Terminal failure states — stop polling and report
      if (
        runningState === 'Failed' ||
        runningState === 'ActivationFailed' ||
        runningState === 'Degraded'
      ) {
        return {
          healthy: false,
          error: `Revision ${latestRevisionName}: ${runningState}`,
        };
      }

      // Still starting, wait and poll again
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    } catch (err: unknown) {
      // API errors during polling — return failure so caller can retry
      return {
        healthy: false,
        error: err instanceof Error ? err.message : 'Unknown polling error',
      };
    }
  }

  return {
    healthy: false,
    error: `Timeout waiting for activation (${timeoutMs}ms)`,
  };
}
