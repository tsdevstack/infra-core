/**
 * Get ACR refresh token via OIDC token exchange
 *
 * Used in CI mode where there's no clientSecret. Exchanges the
 * DefaultAzureCredential AAD token for an ACR refresh token that
 * can be used as a password for Container Apps registry config.
 */

import { DefaultAzureCredential } from '@azure/identity';
import { InfraCoreError } from '../../../runtime/infra-core-error.ts';

export async function getAcrRefreshToken(loginServer: string): Promise<string> {
  try {
    const credential = new DefaultAzureCredential();
    const tokenResponse = await credential.getToken(
      'https://management.azure.com/.default',
    );

    const exchangeResponse = await fetch(
      `https://${loginServer}/oauth2/exchange`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'access_token',
          service: loginServer,
          access_token: tokenResponse.token,
        }),
      },
    );

    if (!exchangeResponse.ok) {
      const errorText = await exchangeResponse.text();
      throw new Error(
        `ACR token exchange failed (${exchangeResponse.status}): ${errorText}`,
      );
    }

    const { refresh_token } = (await exchangeResponse.json()) as {
      refresh_token: string;
    };

    return refresh_token;
  } catch (error) {
    if (error instanceof InfraCoreError) throw error;
    const msg = error instanceof Error ? error.message : 'Unknown error';
    throw new InfraCoreError(
      'Failed to get ACR refresh token',
      'acr-auth',
      `${msg}\n\nEnsure the azure/login action has run and the service principal has AcrPush role.`,
    );
  }
}
