/**
 * Configure Docker authentication for GCP Artifact Registry
 *
 * Supports two modes:
 * - Explicit credentials (local): Get access token from service account
 * - ADC (CI with WIF): Use gcloud to configure Docker (ADC already set up)
 */

import { execSync } from 'node:child_process';
import { GoogleAuth } from 'google-auth-library';
import type { GCPCredentials } from '../../types/credentials.ts';
import { InfraCoreError } from '../../runtime/infra-core-error.ts';
import { dockerLoginWithRetry } from '../shared/docker-login-with-retry.ts';

/**
 * Configure Docker to authenticate with GCP Artifact Registry
 */
export async function configureDockerAuth(
  credentials: GCPCredentials,
  registryHost: string,
): Promise<void> {
  // ADC mode: no private_key means use gcloud to configure Docker
  // WIF/ADC already provides credentials, gcloud configure-docker uses them
  if (!credentials.private_key) {
    try {
      execSync(`gcloud auth configure-docker ${registryHost} --quiet`, {
        stdio: 'pipe',
      });
      return;
    } catch {
      throw new InfraCoreError(
        'Failed to configure Docker with gcloud',
        'docker-auth',
        'Ensure gcloud is authenticated (WIF should have set this up)',
      );
    }
  }

  // Explicit credentials mode: Get access token from service account credentials
  const auth = new GoogleAuth({
    credentials: {
      client_email: credentials.client_email,
      private_key: credentials.private_key,
    },
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  });

  let accessToken: string | null | undefined;
  try {
    accessToken = await auth.getAccessToken();
  } catch {
    throw new InfraCoreError(
      'Failed to get access token from service account credentials',
      'docker-auth',
      'Check that your service account credentials are valid',
    );
  }

  if (!accessToken) {
    throw new InfraCoreError(
      'No access token returned from Google Auth',
      'docker-auth',
      'Check that your service account has the required permissions',
    );
  }

  // Login to Docker using the access token (with retry for API propagation delays)
  try {
    await dockerLoginWithRetry(() => {
      execSync(
        `docker login -u oauth2accesstoken -p "${accessToken}" https://${registryHost}`,
        {
          stdio: 'pipe',
        },
      );
    });
  } catch {
    throw new InfraCoreError(
      'Failed to authenticate Docker with Artifact Registry',
      'docker-auth',
      'Ensure Docker is running and you have permission to push to the registry',
    );
  }
}
