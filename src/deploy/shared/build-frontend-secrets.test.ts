import { describe, it, expect } from '@rstest/core';
import { buildFrontendSecrets } from './build-frontend-secrets';

describe('buildFrontendSecrets', () => {
  const mockBuildSecretName = (
    projectName: string,
    scope: string,
    key: string,
  ): string => `${projectName}-${scope}-${key}`;

  it('should return API_URL and KONG_INTERNAL_URL from shared scope', () => {
    const result = buildFrontendSecrets('my-project', mockBuildSecretName);

    expect(result).toEqual([
      {
        envVar: 'API_URL',
        secretName: 'my-project-shared-API_URL',
        version: 'latest',
      },
      {
        envVar: 'KONG_INTERNAL_URL',
        secretName: 'my-project-shared-KONG_INTERNAL_URL',
        version: 'latest',
      },
    ]);
  });

  it('should not include DATABASE_URL', () => {
    const result = buildFrontendSecrets('my-project', mockBuildSecretName);

    const envVars = result.map((s) => s.envVar);
    expect(envVars).not.toContain('DATABASE_URL');
  });

  describe('with serviceSecretKeys', () => {
    it('should append additional keys from secret map', () => {
      const result = buildFrontendSecrets('my-project', mockBuildSecretName, [
        'API_URL',
        'ACCESS_TOKEN_TTL',
        'REFRESH_TOKEN_TTL',
      ]);

      expect(result).toEqual([
        {
          envVar: 'API_URL',
          secretName: 'my-project-shared-API_URL',
          version: 'latest',
        },
        {
          envVar: 'KONG_INTERNAL_URL',
          secretName: 'my-project-shared-KONG_INTERNAL_URL',
          version: 'latest',
        },
        {
          envVar: 'ACCESS_TOKEN_TTL',
          secretName: 'my-project-shared-ACCESS_TOKEN_TTL',
          version: 'latest',
        },
        {
          envVar: 'REFRESH_TOKEN_TTL',
          secretName: 'my-project-shared-REFRESH_TOKEN_TTL',
          version: 'latest',
        },
      ]);
    });

    it('should not duplicate base keys', () => {
      const result = buildFrontendSecrets('my-project', mockBuildSecretName, [
        'API_URL',
        'KONG_INTERNAL_URL',
      ]);

      const envVars = result.map((s) => s.envVar);
      expect(envVars).toEqual(['API_URL', 'KONG_INTERNAL_URL']);
    });

    it('should handle empty serviceSecretKeys array', () => {
      const result = buildFrontendSecrets(
        'my-project',
        mockBuildSecretName,
        [],
      );

      expect(result).toHaveLength(2);
    });
  });
});
