import { describe, it, expect } from '@rstest/core';
import { buildBackendSecrets } from './build-backend-secrets';

describe('buildBackendSecrets', () => {
  const mockBuildSecretName = (
    projectName: string,
    scope: string,
    key: string,
  ): string => `${projectName}-${scope}-${key}`;

  describe('when service has database', () => {
    it('should return DATABASE_URL secret', () => {
      const result = buildBackendSecrets(
        'my-project',
        'auth-service',
        true,
        mockBuildSecretName,
      );

      expect(result).toEqual([
        {
          envVar: 'DATABASE_URL',
          secretName: 'my-project-auth-service-DATABASE_URL',
          version: 'latest',
        },
      ]);
    });
  });

  describe('when service has no database', () => {
    it('should return empty array', () => {
      const result = buildBackendSecrets(
        'my-project',
        'bff-service',
        false,
        mockBuildSecretName,
      );

      expect(result).toEqual([]);
    });
  });
});
