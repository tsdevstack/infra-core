/**
 * Build secrets configuration for frontend (Next.js) services
 */

import type { SecretConfig, BuildSecretNameFn } from './types.ts';

/**
 * Build secret configs for a frontend service
 *
 * Base secrets (API_URL, KONG_INTERNAL_URL) are always included.
 * When serviceSecretKeys is provided, additional secrets from the
 * service's secret-map entry are appended (deduplicated).
 *
 * @param projectName - Project name for secret naming
 * @param buildSecretName - Function to build cloud secret names
 * @param serviceSecretKeys - Optional list of secret keys from secret-map.json
 */
export function buildFrontendSecrets(
  projectName: string,
  buildSecretName: BuildSecretNameFn,
  serviceSecretKeys?: string[],
): SecretConfig[] {
  const secrets: SecretConfig[] = [
    {
      envVar: 'API_URL',
      secretName: buildSecretName(projectName, 'shared', 'API_URL'),
      version: 'latest',
    },
    {
      // Kong internal URL for server-side API calls (bypasses LB/Cloud Armor)
      envVar: 'KONG_INTERNAL_URL',
      secretName: buildSecretName(projectName, 'shared', 'KONG_INTERNAL_URL'),
      version: 'latest',
    },
  ];

  if (serviceSecretKeys) {
    const alreadyIncluded = new Set(secrets.map((s) => s.envVar));

    for (const key of serviceSecretKeys) {
      if (!alreadyIncluded.has(key)) {
        secrets.push({
          envVar: key,
          secretName: buildSecretName(projectName, 'shared', key),
          version: 'latest',
        });
      }
    }
  }

  return secrets;
}
