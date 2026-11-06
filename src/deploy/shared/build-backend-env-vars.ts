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
  /** LOG_LEVEL (pino level); the service's logger defaults to info without it */
  logLevel?: string;
  /** A worker's own name (auth-worker): its log lines carry it */
  workerName?: string;
  /** TRACE_SAMPLE_RATE (tracing.sampleRate); the service keeps every trace without it */
  traceSampleRate?: number;
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

  if (config.logLevel) {
    envVars.LOG_LEVEL = config.logLevel;
  }
  if (config.workerName) {
    envVars.WORKER_NAME = config.workerName;
  }
  if (config.traceSampleRate !== undefined) {
    envVars.TRACE_SAMPLE_RATE = String(config.traceSampleRate);
  }

  if (config.provider === 'gcp') {
    envVars.GCP_PROJECT_ID = config.projectId;
  } else if (config.provider === 'aws') {
    envVars.AWS_REGION = config.awsRegion ?? 'us-east-1';
  }

  return envVars;
}
