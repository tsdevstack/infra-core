/**
 * Configure Docker authentication for Azure Container Registry
 *
 * Supports two modes:
 * - Explicit credentials (local): Docker login with service principal
 * - CI (OIDC): DefaultAzureCredential + ACR token exchange
 */

import { spawnSync } from 'node:child_process';
import type { AzureCredentials } from '../../../types/credentials.ts';
import type { InfraCoreRuntime } from '../../../types/runtime.ts';
import { InfraCoreError } from '../../../runtime/infra-core-error.ts';
import { getAcrRefreshToken } from './get-acr-refresh-token.ts';
import { dockerLoginWithRetry } from '../../shared/docker-login-with-retry.ts';

/**
 * Configure Docker to authenticate with ACR
 */
export async function configureAcrAuth(
  runtime: InfraCoreRuntime,
  credentials: AzureCredentials,
  loginServer: string,
): Promise<void> {
  // CI mode: use DefaultAzureCredential (OIDC from azure/login action)
  // Exchange AAD token for ACR refresh token, then docker login
  if (runtime.isCIEnv()) {
    try {
      const refreshToken = await getAcrRefreshToken(loginServer);

      // Docker login with ACR refresh token (with retry for API propagation delays)
      await dockerLoginWithRetry(() => {
        const result = spawnSync(
          'docker',
          [
            'login',
            loginServer,
            '--username',
            '00000000-0000-0000-0000-000000000000',
            '--password-stdin',
          ],
          {
            input: refreshToken,
            encoding: 'utf-8',
          },
        );

        if (result.status !== 0) {
          const errorMsg = result.stderr || result.stdout || 'Unknown error';
          throw new Error(`Docker login failed: ${errorMsg}`);
        }
      });

      return;
    } catch (error) {
      if (error instanceof InfraCoreError) throw error;
      const msg = error instanceof Error ? error.message : 'Unknown error';
      throw new InfraCoreError(
        'Failed to configure Docker with ACR in CI mode',
        'acr-auth',
        `${msg}\n\nEnsure the azure/login action has run and the service principal has AcrPush role.`,
      );
    }
  }

  // Local mode: Docker login with service principal credentials
  if (!credentials.clientSecret) {
    throw new InfraCoreError(
      'Azure client secret is required for local Docker authentication',
      'acr-auth',
      'Ensure clientSecret is set in .tsdevstack/.credentials.azure.json',
    );
  }

  // Docker login with service principal (with retry for API propagation delays)
  try {
    await dockerLoginWithRetry(() => {
      const result = spawnSync(
        'docker',
        [
          'login',
          loginServer,
          '--username',
          credentials.clientId,
          '--password-stdin',
        ],
        {
          input: credentials.clientSecret,
          encoding: 'utf-8',
        },
      );

      if (result.status !== 0) {
        const errorMsg = result.stderr || result.stdout || 'Unknown error';
        throw new Error(`Docker login failed: ${errorMsg}`);
      }
    });
  } catch (error) {
    if (error instanceof InfraCoreError) throw error;
    const msg = error instanceof Error ? error.message : 'Unknown error';
    throw new InfraCoreError(
      'Failed to authenticate Docker with ACR',
      'acr-auth',
      `${msg}\n\nEnsure Docker is running and your service principal has AcrPush role.`,
    );
  }
}
