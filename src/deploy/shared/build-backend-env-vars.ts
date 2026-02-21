/**
 * Build environment variables for backend (NestJS) services
 */

import type { CloudProvider } from '../../types/credentials.ts';

interface BackendEnvVarsConfig {
  provider: CloudProvider;
  projectName: string;
  /** GCP project ID or AWS account ID */
  projectId: string;
  poolMax: number;
  /** AWS region (required for AWS) */
  awsRegion?: string;
}

export function buildBackendEnvVars(
  config: BackendEnvVarsConfig,
): Record<string, string> {
  const envVars: Record<string, string> = {
    NODE_ENV: 'production',
    SECRETS_PROVIDER: config.provider,
    PROJECT_NAME: config.projectName,
    DB_POOL_MAX: String(config.poolMax),
  };

  if (config.provider === 'gcp') {
    envVars.GCP_PROJECT_ID = config.projectId;
  } else if (config.provider === 'aws') {
    envVars.AWS_REGION = config.awsRegion ?? 'us-east-1';
  }

  return envVars;
}
