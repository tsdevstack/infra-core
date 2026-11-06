import { describe, it, expect } from '@rstest/core';
import { buildFrontendEnvVars } from './build-frontend-env-vars';

describe('buildFrontendEnvVars', () => {
  describe('Standard use cases', () => {
    it("should tell the frontend's telemetry its cloud and project on GCP", () => {
      const result = buildFrontendEnvVars({
        provider: 'gcp',
        projectId: 'shop-dev',
        traceSampleRate: 0.5,
      });

      expect(result).toEqual({
        NODE_ENV: 'production',
        TELEMETRY_PROVIDER: 'gcp',
        GCP_PROJECT_ID: 'shop-dev',
        TRACE_SAMPLE_RATE: '0.5',
      });
    });

    it('should name the cloud only on Azure', () => {
      expect(buildFrontendEnvVars({ provider: 'azure' })).toEqual({
        NODE_ENV: 'production',
        TELEMETRY_PROVIDER: 'azure',
      });
    });
  });

  describe('Edge cases', () => {
    it('should not include backend-specific env vars', () => {
      const result = buildFrontendEnvVars({
        provider: 'gcp',
        projectId: 'shop-dev',
      });

      expect(result).not.toHaveProperty('SECRETS_PROVIDER');
      expect(result).not.toHaveProperty('PROJECT_NAME');
      expect(result).not.toHaveProperty('DB_POOL_MAX');
    });

    it('should keep the project out on other clouds', () => {
      expect(
        buildFrontendEnvVars({ provider: 'azure', projectId: 'x' }),
      ).not.toHaveProperty('GCP_PROJECT_ID');
    });
  });
});
