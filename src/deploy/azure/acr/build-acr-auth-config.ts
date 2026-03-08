/**
 * Build ACR Auth Config
 *
 * Encapsulates the managed-identity-vs-password registry auth logic
 * for Azure Container Apps and Container Apps Jobs.
 *
 * - Managed identity: no secrets needed, uses identity-based pull
 * - Password (local SP): uses clientSecret as ACR password
 * - OIDC (CI): exchanges federated token for ACR refresh token
 */

import { getAcrRefreshToken } from './get-acr-refresh-token.ts';
import type { ContainerAppIdentity } from '../types/index.ts';
import type { AzureCredentials } from '../../../types/credentials.ts';

export interface AcrAuthConfig {
  registries?: Array<Record<string, string>>;
  identity?: ContainerAppIdentity;
  secrets: Array<{ name: string; value: string }>;
}

export interface BuildAcrAuthConfigOptions {
  acrLoginServer?: string;
  acrManagedIdentityId?: string;
  credentials: AzureCredentials;
}

export async function buildAcrAuthConfig(
  options: BuildAcrAuthConfigOptions,
): Promise<AcrAuthConfig> {
  const { acrLoginServer, acrManagedIdentityId, credentials } = options;

  if (acrLoginServer && acrManagedIdentityId) {
    // Managed identity — no tokens to expire, works with scale-to-zero
    return {
      registries: [{ server: acrLoginServer, identity: acrManagedIdentityId }],
      identity: {
        type: 'UserAssigned',
        userAssignedIdentities: { [acrManagedIdentityId]: {} },
      },
      secrets: [],
    };
  }

  if (acrLoginServer) {
    // Fallback: password-based auth (short-lived tokens)
    // Local: SP client secret as password
    // CI: exchange OIDC token for ACR refresh token
    let acrUsername: string;
    let acrPassword: string;

    if (credentials.clientSecret) {
      acrPassword = credentials.clientSecret;
      acrUsername = credentials.clientId;
    } else {
      acrPassword = await getAcrRefreshToken(acrLoginServer);
      acrUsername = '00000000-0000-0000-0000-000000000000';
    }

    return {
      registries: [
        {
          server: acrLoginServer,
          username: acrUsername,
          passwordSecretRef: 'acr-password',
        },
      ],
      secrets: [{ name: 'acr-password', value: acrPassword }],
    };
  }

  // No ACR configured
  return { secrets: [] };
}
