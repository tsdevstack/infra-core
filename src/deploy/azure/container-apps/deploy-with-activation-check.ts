/**
 * Deploy with Activation Check
 *
 * Deploys a Container App and optionally verifies replica activation
 * with retry for Azure RBAC propagation delays.
 *
 * When using managed identity with minReplicas=0, we deploy with min=1
 * to force a replica, verify the image can be pulled, then scale back.
 * RBAC propagation after Terraform can take minutes, so we retry the
 * activation check (not the deployment itself).
 */

import { createOrUpdateContainerApp } from './create-or-update-container-app.ts';
import { waitForContainerAppReady } from './wait-for-container-app-ready.ts';
import { waitForContainerAppActivation } from './wait-for-container-app-activation.ts';
import type { CreateOrUpdateContainerAppOptions } from './create-or-update-container-app.ts';
import type { InfraCoreRuntime } from '../../../types/runtime.ts';
import type { AzureCredentials } from '../../../types/credentials.ts';

const DEFAULT_MAX_RETRIES = 6;
const DEFAULT_RETRY_DELAY_MS = 15_000;

export interface DeployWithActivationCheckOptions {
  runtime: InfraCoreRuntime;
  credentials: AzureCredentials;
  resourceGroupName: string;
  containerAppName: string;
  createOptions: CreateOrUpdateContainerAppOptions;
  needsActivationCheck: boolean;
  targetMinReplicas: number;
  logger: { info: (msg: string) => void; warn: (msg: string) => void };
  /** Max activation retries (default: 6) */
  maxRetries?: number;
  /** Delay between retries in ms (default: 15000) */
  retryDelayMs?: number;
}

export interface DeployWithActivationCheckResult {
  activated: boolean;
  fqdn?: string;
  error?: string;
}

export async function deployWithActivationCheck(
  options: DeployWithActivationCheckOptions,
): Promise<DeployWithActivationCheckResult> {
  const {
    runtime,
    credentials,
    resourceGroupName,
    containerAppName,
    createOptions,
    needsActivationCheck,
    targetMinReplicas,
    logger,
    maxRetries = DEFAULT_MAX_RETRIES,
    retryDelayMs = DEFAULT_RETRY_DELAY_MS,
  } = options;

  // Step 1: Deploy the container app (once)
  let fqdn: string | undefined;
  try {
    const result = await createOrUpdateContainerApp(runtime, createOptions);
    fqdn = result.fqdn;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    const hint = (err as { hint?: string })?.hint;
    return {
      activated: false,
      error: hint ? `${errorMsg}: ${hint}` : errorMsg,
    };
  }

  // Step 2: Wait for ARM provisioning
  try {
    await waitForContainerAppReady(runtime, {
      credentials,
      resourceGroupName,
      containerAppName,
      timeoutMs: 300000,
    });
  } catch (err) {
    return {
      activated: false,
      error:
        err instanceof Error
          ? err.message
          : 'Service did not reach ready state',
    };
  }

  // No activation check needed — done
  if (!needsActivationCheck) {
    return { activated: true, fqdn };
  }

  // Step 3: Verify replica activation with retry (RBAC propagation)
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const activation = await waitForContainerAppActivation(runtime, {
      credentials,
      resourceGroupName,
      containerAppName,
    });

    if (activation.healthy) {
      // Step 4: Scale back to target minReplicas now that image pull is verified
      try {
        await createOrUpdateContainerApp(runtime, {
          ...createOptions,
          minReplicas: targetMinReplicas,
        });
      } catch {
        // Non-fatal: service works, just won't scale to target yet
        logger.warn(
          `  Could not scale ${containerAppName} to minReplicas=${targetMinReplicas}`,
        );
      }

      return { activated: true, fqdn };
    }

    if (attempt < maxRetries) {
      logger.warn(
        `  ACR identity RBAC propagating, retry ${attempt}/${maxRetries} in ${retryDelayMs / 1000}s... (${activation.error})`,
      );
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    } else {
      return {
        activated: false,
        error: `Activation failed after ${maxRetries} retries: ${activation.error}`,
      };
    }
  }

  // Unreachable, but TypeScript needs it
  return { activated: false, error: 'Unexpected state' };
}
