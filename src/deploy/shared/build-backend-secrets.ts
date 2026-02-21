/**
 * Build secrets configuration for backend (NestJS) services
 */

import type { SecretConfig, BuildSecretNameFn } from './types.ts';

export function buildBackendSecrets(
  projectName: string,
  serviceName: string,
  hasDatabase: boolean,
  buildSecretName: BuildSecretNameFn,
): SecretConfig[] {
  const secrets: SecretConfig[] = [];

  if (hasDatabase) {
    secrets.push({
      envVar: 'DATABASE_URL',
      secretName: buildSecretName(projectName, serviceName, 'DATABASE_URL'),
      version: 'latest',
    });
  }

  return secrets;
}
