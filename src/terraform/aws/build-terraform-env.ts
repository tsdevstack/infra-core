/**
 * Build Terraform Environment Variables for AWS
 *
 * Creates the environment variables needed for Terraform AWS operations.
 * Handles both local mode (with access keys) and CI mode (with IAM roles/OIDC).
 */

import type { AWSCredentials } from '../../types/credentials.ts';
import type { InfraCoreRuntime } from '../../types/runtime.ts';

/**
 * Build environment variables for Terraform execution on AWS
 *
 * In local mode: Sets AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY
 * In CI mode: Relies on IAM role credentials (OIDC or instance profile)
 */
export function buildTerraformEnv(
  runtime: InfraCoreRuntime,
  credentials: AWSCredentials,
): Record<string, string> {
  const env: Record<string, string> = {
    AWS_REGION: credentials.region,
    AWS_DEFAULT_REGION: credentials.region,
  };

  // Only set access keys in local mode
  // CI uses OIDC or IAM role credentials
  if (!runtime.isCIEnv()) {
    env.AWS_ACCESS_KEY_ID = credentials.accessKeyId;
    env.AWS_SECRET_ACCESS_KEY = credentials.secretAccessKey;
  }

  return env;
}
