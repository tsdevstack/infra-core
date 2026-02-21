/**
 * Build Terraform Environment Variables
 *
 * Creates the environment variables needed for Terraform GCP operations.
 * Handles both local mode (with service account JSON) and CI mode (with ADC/WIF).
 */

import type { GCPCredentials } from '../../types/credentials.ts';
import type { InfraCoreRuntime } from '../../types/runtime.ts';

/**
 * Build environment variables for Terraform execution
 *
 * In local mode: Sets GOOGLE_CREDENTIALS with full service account JSON
 * In CI mode (WIF): Relies on Application Default Credentials
 */
export function buildTerraformEnv(
  runtime: InfraCoreRuntime,
  credentials: GCPCredentials,
): Record<string, string> {
  const env: Record<string, string> = {
    GOOGLE_PROJECT: credentials.project_id,
    GOOGLE_REGION: credentials.region,
  };

  // Only set GOOGLE_CREDENTIALS in local mode (has full service account JSON)
  // CI uses Workload Identity Federation via ADC
  if (!runtime.isCIEnv()) {
    env.GOOGLE_CREDENTIALS = JSON.stringify(credentials);
  }

  return env;
}
