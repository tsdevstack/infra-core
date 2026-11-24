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
  describe('Log level and worker name', () => {
    it('should set LOG_LEVEL and WORKER_NAME when given', () => {
      const result = buildBackendEnvVars({
        provider: 'gcp',
        projectName: 'my-project',
        projectId: 'my-project-dev',
        poolMax: 5,
        logLevel: 'debug',
        workerName: 'auth-worker',
      });

      expect(result.LOG_LEVEL).toBe('debug');
      expect(result.WORKER_NAME).toBe('auth-worker');
    });

    it('should leave both out when not given', () => {
      const result = buildBackendEnvVars({
        provider: 'azure',
        projectName: 'my-project',
        projectId: 'sub-id',
        poolMax: 5,
      });

      expect(result.LOG_LEVEL).toBeUndefined();
      expect(result.WORKER_NAME).toBeUndefined();
    });
  });
  describe('Trace sample rate', () => {
    it('should set TRACE_SAMPLE_RATE when given, 0 included', () => {
      const base = {
        provider: 'gcp' as const,
        projectName: 'my-project',
        projectId: 'my-project-dev',
        poolMax: 5,
      };

      expect(
        buildBackendEnvVars({ ...base, traceSampleRate: 0.25 })
          .TRACE_SAMPLE_RATE,
      ).toBe('0.25');
      expect(
        buildBackendEnvVars({ ...base, traceSampleRate: 0 }).TRACE_SAMPLE_RATE,
      ).toBe('0');
      expect(buildBackendEnvVars(base).TRACE_SAMPLE_RATE).toBeUndefined();
    });
  });
  describe('Cron jobs', () => {
    it("should pass the run's name and timeout to the runner", () => {
      const result = buildBackendEnvVars({
        provider: 'gcp',
        projectName: 'my-project',
        projectId: 'my-project-dev',
        poolMax: 5,
        cronJob: { name: 'usage-report', timeoutSeconds: 1800 },
      });

      expect(result.CRON_JOB_NAME).toBe('usage-report');
      expect(result.CRON_JOB_TIMEOUT).toBe('1800');
      expect(result.WORKER_NAME).toBeUndefined();
    });

    it('should set neither for a service', () => {
      const result = buildBackendEnvVars({
        provider: 'aws',
        projectName: 'my-project',
        projectId: '123456789012',
        poolMax: 5,
        awsRegion: 'eu-west-1',
      });

      expect(result).not.toHaveProperty('CRON_JOB_NAME');
      expect(result).not.toHaveProperty('CRON_JOB_TIMEOUT');
    });
  });
});
