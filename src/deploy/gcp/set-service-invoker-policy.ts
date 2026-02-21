/**
 * Set IAM policy to allow allUsers to invoke a Cloud Run service
 *
 * Used for internal-only services where ingress restricts access to VPC.
 * Supports two modes:
 * - Explicit credentials (local): Write temp file for gcloud
 * - ADC (CI with WIF): gcloud uses ADC automatically
 */

import { execSync } from 'node:child_process';
import type { InfraCoreRuntime } from '../../types/runtime.ts';
import type { GCPCredentials } from '../../types/credentials.ts';

export interface SetServiceInvokerPolicyOptions {
  projectId: string;
  region: string;
  serviceName: string;
  credentials: GCPCredentials;
}

/**
 * Set IAM policy to allow allUsers to invoke the service
 */
export async function setServiceInvokerPolicy(
  runtime: InfraCoreRuntime,
  options: SetServiceInvokerPolicyOptions,
): Promise<void> {
  const gcloudCommand =
    `gcloud run services add-iam-policy-binding ${options.serviceName} ` +
    `--region=${options.region} ` +
    `--project=${options.projectId} ` +
    `--member="allUsers" ` +
    `--role="roles/run.invoker" ` +
    `--quiet`;

  // ADC mode: no private_key means gcloud uses ADC (WIF)
  if (!options.credentials.private_key) {
    try {
      execSync(gcloudCommand, { stdio: ['pipe', 'pipe', 'pipe'] });
      runtime.logger.success('  IAM: allUsers can invoke (VPC-only ingress)');
    } catch {
      runtime.logger.warn(
        '  Could not set IAM invoker policy (may already exist)',
      );
    }
    return;
  }

  // Explicit credentials mode: write temp file for gcloud
  // Note: Uses direct fs import for temp file handling with secure mode (0o600)
  // and cleanup (mkdtempSync/rmdirSync) - not available via context utilities
  const fs = await import('node:fs');
  const os = await import('node:os');
  const path = await import('node:path');

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gcloud-'));
  const credFile = path.join(tempDir, 'credentials.json');

  const credentialsJson = JSON.stringify({
    type: 'service_account',
    project_id: options.credentials.project_id,
    private_key: options.credentials.private_key,
    client_email: options.credentials.client_email,
  });

  try {
    fs.writeFileSync(credFile, credentialsJson, { mode: 0o600 });

    execSync(gcloudCommand, {
      env: {
        ...process.env,
        GOOGLE_APPLICATION_CREDENTIALS: credFile,
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    runtime.logger.success('  IAM: allUsers can invoke (VPC-only ingress)');
  } catch {
    // Non-fatal - might already have the binding
    runtime.logger.warn(
      '  Could not set IAM invoker policy (may already exist)',
    );
  } finally {
    // Cleanup temp credentials
    try {
      fs.unlinkSync(credFile);
      fs.rmdirSync(tempDir);
    } catch {
      // Ignore cleanup errors
    }
  }
}
