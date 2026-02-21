/**
 * Build Terraform Environment Variables for Azure
 *
 * Creates the environment variables needed for Terraform azurerm provider.
 * Handles both local mode (with service principal) and CI mode (with OIDC).
 */

import type { AzureCredentials } from '../../types/credentials.ts';
import type { InfraCoreRuntime } from '../../types/runtime.ts';

/**
 * Build environment variables for Terraform execution on Azure
 *
 * In local mode: Sets ARM_CLIENT_ID, ARM_CLIENT_SECRET, ARM_TENANT_ID, ARM_SUBSCRIPTION_ID
 * In CI mode: Relies on OIDC credentials from azure/login action
 */
export function buildTerraformEnv(
  runtime: InfraCoreRuntime,
  credentials: AzureCredentials,
): Record<string, string> {
  const env: Record<string, string> = {
    ARM_SUBSCRIPTION_ID: credentials.subscriptionId,
    ARM_TENANT_ID: credentials.tenantId,
  };

  // Only set client credentials in local mode
  // CI uses OIDC via azure/login action
  if (!runtime.isCIEnv() && credentials.clientSecret) {
    env.ARM_CLIENT_ID = credentials.clientId;
    env.ARM_CLIENT_SECRET = credentials.clientSecret;
  }

  return env;
}
