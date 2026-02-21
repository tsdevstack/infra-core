import { describe, it, expect, rs, beforeEach } from '@rstest/core';
import { execSync } from 'node:child_process';
import { setServiceInvokerPolicy } from './set-service-invoker-policy';

rs.mock('node:child_process', () => ({
  execSync: rs.fn(),
}));

const mockRuntime = {
  logger: {
    info: rs.fn(),
    success: rs.fn(),
    error: rs.fn(),
    warn: rs.fn(),
    debug: rs.fn(),
    newline: rs.fn(),
    generating: rs.fn(),
    running: rs.fn(),
    creating: rs.fn(),
    building: rs.fn(),
    checking: rs.fn(),
    complete: rs.fn(),
  },
  executeCommand: rs.fn(),
  writeFile: rs.fn(),
  readFile: rs.fn(),
  ensureDirectory: rs.fn(),
  cleanupFolder: rs.fn(),
  isCIEnv: rs.fn(),
};

describe('setServiceInvokerPolicy', () => {
  const mockExecSync = rs.mocked(execSync);

  beforeEach(() => {
    rs.resetAllMocks();
  });

  describe('ADC mode (no private_key)', () => {
    it('should execute gcloud command without credentials file', async () => {
      const options = {
        projectId: 'my-project',
        region: 'us-central1',
        serviceName: 'my-service',
        credentials: {
          project_id: 'my-project',
          client_email: 'sa@my-project.iam.gserviceaccount.com',
          region: 'us-central1',
          // No private_key - ADC mode
        },
      };

      await setServiceInvokerPolicy(mockRuntime, options);

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining(
          'gcloud run services add-iam-policy-binding my-service',
        ),
        expect.objectContaining({ stdio: ['pipe', 'pipe', 'pipe'] }),
      );
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('--region=us-central1'),
        expect.anything(),
      );
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('--project=my-project'),
        expect.anything(),
      );
    });

    it('should log success on successful execution', async () => {
      const options = {
        projectId: 'my-project',
        region: 'us-central1',
        serviceName: 'my-service',
        credentials: {
          project_id: 'my-project',
          client_email: 'sa@test.iam',
          region: 'us-central1',
        },
      };

      await setServiceInvokerPolicy(mockRuntime, options);

      expect(mockRuntime.logger.success).toHaveBeenCalledWith(
        expect.stringContaining('IAM: allUsers can invoke'),
      );
    });

    it('should warn on failure (non-fatal)', async () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('Command failed');
      });

      const options = {
        projectId: 'my-project',
        region: 'us-central1',
        serviceName: 'my-service',
        credentials: {
          project_id: 'my-project',
          client_email: 'sa@test.iam',
          region: 'us-central1',
        },
      };

      await setServiceInvokerPolicy(mockRuntime, options);

      expect(mockRuntime.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Could not set IAM invoker policy'),
      );
    });
  });

  describe('Explicit credentials mode (with private_key)', () => {
    it('should create temp credentials file when private_key is provided', async () => {
      const options = {
        projectId: 'my-project',
        region: 'us-central1',
        serviceName: 'my-service',
        credentials: {
          project_id: 'my-project',
          client_email: 'sa@my-project.iam.gserviceaccount.com',
          private_key:
            '-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----',
          region: 'us-central1',
        },
      };

      await setServiceInvokerPolicy(mockRuntime, options);

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('gcloud run services add-iam-policy-binding'),
        expect.objectContaining({
          env: expect.objectContaining({
            GOOGLE_APPLICATION_CREDENTIALS:
              expect.stringContaining('credentials.json'),
          }),
        }),
      );
    });

    it('should log success with explicit credentials', async () => {
      const options = {
        projectId: 'my-project',
        region: 'us-central1',
        serviceName: 'my-service',
        credentials: {
          project_id: 'my-project',
          client_email: 'sa@test.iam',
          private_key:
            '-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----',
          region: 'us-central1',
        },
      };

      await setServiceInvokerPolicy(mockRuntime, options);

      expect(mockRuntime.logger.success).toHaveBeenCalledWith(
        expect.stringContaining('IAM: allUsers can invoke'),
      );
    });

    it('should warn on failure with explicit credentials', async () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('Command failed');
      });

      const options = {
        projectId: 'my-project',
        region: 'us-central1',
        serviceName: 'my-service',
        credentials: {
          project_id: 'my-project',
          client_email: 'sa@test.iam',
          private_key:
            '-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----',
          region: 'us-central1',
        },
      };

      await setServiceInvokerPolicy(mockRuntime, options);

      expect(mockRuntime.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Could not set IAM invoker policy'),
      );
    });
  });
});
