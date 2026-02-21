import { describe, it, expect } from '@rstest/core';
import { buildBackendEnvVars } from './build-backend-env-vars';

describe('buildBackendEnvVars', () => {
  describe('GCP provider', () => {
    it('should return correct env vars for GCP backend service', () => {
      const result = buildBackendEnvVars({
        provider: 'gcp',
        projectName: 'my-project',
        projectId: 'my-project-dev',
        poolMax: 5,
      });

      expect(result).toEqual({
        NODE_ENV: 'production',
        SECRETS_PROVIDER: 'gcp',
        PROJECT_NAME: 'my-project',
        GCP_PROJECT_ID: 'my-project-dev',
        DB_POOL_MAX: '5',
      });
    });

    it('should convert poolMax to string', () => {
      const result = buildBackendEnvVars({
        provider: 'gcp',
        projectName: 'test',
        projectId: 'test-id',
        poolMax: 10,
      });

      expect(result.DB_POOL_MAX).toBe('10');
      expect(typeof result.DB_POOL_MAX).toBe('string');
    });
  });

  describe('AWS provider', () => {
    it('should return correct env vars for AWS backend service', () => {
      const result = buildBackendEnvVars({
        provider: 'aws',
        projectName: 'my-project',
        projectId: '123456789012',
        poolMax: 5,
        awsRegion: 'us-west-2',
      });

      expect(result).toEqual({
        NODE_ENV: 'production',
        SECRETS_PROVIDER: 'aws',
        PROJECT_NAME: 'my-project',
        AWS_REGION: 'us-west-2',
        DB_POOL_MAX: '5',
      });
    });

    it('should default AWS region to us-east-1', () => {
      const result = buildBackendEnvVars({
        provider: 'aws',
        projectName: 'test',
        projectId: '123456789012',
        poolMax: 5,
      });

      expect(result.AWS_REGION).toBe('us-east-1');
    });
  });
});
