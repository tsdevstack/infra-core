/**
 * Build environment variables for frontend (Next.js) services
 */

import type { CloudProvider } from '../../types/credentials.ts';

interface FrontendEnvVarsConfig {
  provider: CloudProvider;
  /** GCP project ID: Google needs it on every span the frontend sends */
  projectId?: string;
  /** TRACE_SAMPLE_RATE (tracing.sampleRate) */
  traceSampleRate?: number;
}

export function buildFrontendEnvVars(
  config: FrontendEnvVarsConfig,
): Record<string, string> {
  // TELEMETRY_PROVIDER tells @tsdevstack/telemetry (instrumentation.ts)
  // where to send the frontend's traces
  const envVars: Record<string, string> = {
    NODE_ENV: 'production',
    TELEMETRY_PROVIDER: config.provider,
  };

  if (config.provider === 'gcp' && config.projectId) {
    envVars.GCP_PROJECT_ID = config.projectId;
  }
  if (config.traceSampleRate !== undefined) {
    envVars.TRACE_SAMPLE_RATE = String(config.traceSampleRate);
  }

  return envVars;
}
