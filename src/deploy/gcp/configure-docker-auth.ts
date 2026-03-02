/**
 * Configure Docker authentication for GCP Artifact Registry
 *
 * Supports two modes:
 * - Explicit credentials (local): Use Google Auth SDK with service account key
 * - ADC (CI with WIF): Use Google Auth SDK with default credential provider chain
 */

import { GoogleAuth } from 'google-auth-library';
import type { GCPCredentials } from '../../types/credentials.ts';
import { InfraCoreError } from '../../runtime/infra-core-error.ts';
import { dockerLoginWithRetry } from '../shared/docker-login-with-retry.ts';
import { dockerLoginViaStdin } from '../shared/docker-login-via-stdin.ts';

/**
 * Configure Docker to authenticate with GCP Artifact Registry
 */
export async function configureDockerAuth(
  credentials: GCPCredentials,
  registryHost: string,
): Promise<void> {
  // CI (WIF/ADC): let SDK resolve credentials from environment
  // Local: use explicit service account key
  const auth = credentials.private_key
    ? new GoogleAuth({
        credentials: {
          client_email: credentials.client_email,
          private_key: credentials.private_key,
        },
        scopes: ['https://www.googleapis.com/auth/cloud-platform'],
      })
    : new GoogleAuth({
        projectId: credentials.project_id,
        scopes: ['https://www.googleapis.com/auth/cloud-platform'],
      });

  let accessToken: string | null | undefined;
  try {
    accessToken = await auth.getAccessToken();
  } catch {
    throw new InfraCoreError(
      'Failed to get access token',
      'docker-auth',
      credentials.private_key
        ? 'Check that your service account credentials are valid'
        : 'Check that ADC/WIF credentials are configured in the environment',
    );
  }

  if (!accessToken) {
    throw new InfraCoreError(
      'No access token returned from Google Auth',
      'docker-auth',
      'Check that your credentials have the required permissions',
    );
  }

  // Login to Docker using the access token (with retry for API propagation delays)
  try {
    await dockerLoginWithRetry(() =>
      dockerLoginViaStdin(
        `https://${registryHost}`,
        'oauth2accesstoken',
        accessToken,
      ),
    );
  } catch {
    throw new InfraCoreError(
      'Failed to authenticate Docker with Artifact Registry',
      'docker-auth',
      'Ensure Docker is running and you have permission to push to the registry',
    );
  }
}
