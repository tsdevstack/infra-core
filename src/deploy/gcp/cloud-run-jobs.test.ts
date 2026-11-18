import { describe, it, expect, rs, beforeEach } from '@rstest/core';

const { mockUpdateJob, mockRunJob, mockGetExecution } = rs.hoisted(() => ({
  mockUpdateJob: rs.fn(),
  mockRunJob: rs.fn(),
  mockGetExecution: rs.fn(),
}));

rs.mock('@google-cloud/run', () => ({
  JobsClient: class {
    updateJob = mockUpdateJob;
    runJob = mockRunJob;
  },
  ExecutionsClient: class {
    getExecution = mockGetExecution;
  },
}));
rs.mock('./fetch-cloud-run-logs.ts', () => ({
  fetchJobLogs: rs.fn(async () => 'logs'),
}));
// No real waiting between status checks
rs.mock('../../utils/async/sleep.ts', () => ({
  sleep: rs.fn(async () => {}),
}));

import { executeCloudRunJob, type CloudRunJobOptions } from './cloud-run-jobs';

const runtime = {
  logger: {
    info: rs.fn(),
    success: rs.fn(),
    warn: rs.fn(),
    error: rs.fn(),
  },
} as unknown as Parameters<typeof executeCloudRunJob>[0];

const base: CloudRunJobOptions = {
  projectId: 'gcp-shop',
  region: 'europe-west1',
  jobName: 'shop-db-init',
  imageUri: 'europe-west1-docker.pkg.dev/gcp-shop/shop/db-init:latest',
  command: ['node', 'index.js'],
  vpcNetwork: 'projects/gcp-shop/global/networks/shop-vpc',
  vpcSubnet: 'projects/gcp-shop/regions/europe-west1/subnetworks/shop-subnet',
  serviceAccount: 'shop-db-jobs@gcp-shop.iam.gserviceaccount.com',
  credentials: {
    project_id: 'gcp-shop',
    region: 'europe-west1',
    client_email: 'x@gcp-shop.iam.gserviceaccount.com',
    private_key: 'k',
  },
};

/** The env of the container the job was created with */
function jobEnv(): unknown[] {
  return mockUpdateJob.mock.calls[0][0].job.template.template.containers[0].env;
}

describe('executeCloudRunJob', () => {
  beforeEach(() => {
    rs.clearAllMocks();
    mockUpdateJob.mockResolvedValue([{ promise: async () => [{}] }]);
    const execution =
      'projects/gcp-shop/locations/europe-west1/jobs/shop-db-init/executions/e1';
    mockRunJob.mockResolvedValue([
      {
        metadata: { name: execution },
        promise: async () => [{ name: execution }],
      },
    ]);
    mockGetExecution.mockResolvedValue([
      { completionTime: {}, succeededCount: 1, failedCount: 0 },
    ]);
  });

  describe('Standard use cases', () => {
    it('should give a migration job DATABASE_URL from its secret', async () => {
      await executeCloudRunJob(runtime, {
        ...base,
        secretName: 'shop-auth-service-MIGRATION_DATABASE_URL',
      });

      expect(jobEnv()).toEqual([
        {
          name: 'DATABASE_URL',
          valueSource: {
            secretKeyRef: {
              secret: 'shop-auth-service-MIGRATION_DATABASE_URL',
              version: 'latest',
            },
          },
        },
      ]);
    });

    it('should set more secrets and plain variables', async () => {
      const result = await executeCloudRunJob(runtime, {
        ...base,
        secretEnv: { DB_ADMIN_PASSWORD: 'shop-db-admin-password' },
        env: { MODE: 'init', SERVICES: '["auth-service"]' },
      });

      expect(result.success).toBe(true);
      expect(jobEnv()).toEqual([
        {
          name: 'DB_ADMIN_PASSWORD',
          valueSource: {
            secretKeyRef: {
              secret: 'shop-db-admin-password',
              version: 'latest',
            },
          },
        },
        { name: 'MODE', value: 'init' },
        { name: 'SERVICES', value: '["auth-service"]' },
      ]);
    });
  });

  describe('Edge cases', () => {
    it('should create the job with no variables when none are given', async () => {
      await executeCloudRunJob(runtime, base);

      expect(jobEnv()).toEqual([]);
    });

    it("should stop the job's task after 300 seconds by default", async () => {
      await executeCloudRunJob(runtime, base);

      const template = mockUpdateJob.mock.calls[0][0].job.template.template;
      expect(template.timeout).toEqual({ seconds: 300 });
    });

    it('should take a longer time limit (saving or restoring a database)', async () => {
      await executeCloudRunJob(runtime, { ...base, timeoutSeconds: 3600 });

      const template = mockUpdateJob.mock.calls[0][0].job.template.template;
      expect(template.timeout).toEqual({ seconds: 3600 });
    });

    it('should keep waiting when a status check gets no answer', async () => {
      mockGetExecution
        .mockRejectedValueOnce(
          Object.assign(new Error('Deadline'), { code: 4 }),
        )
        .mockRejectedValueOnce(
          Object.assign(new Error('Unavailable'), { code: 14 }),
        );

      const result = await executeCloudRunJob(runtime, base);

      expect(result.success).toBe(true);
      expect(mockGetExecution).toHaveBeenCalledTimes(3);
    });

    it('should fail on any other error of a status check', async () => {
      mockGetExecution.mockRejectedValueOnce(
        Object.assign(new Error('Permission denied'), { code: 7 }),
      );

      await expect(executeCloudRunJob(runtime, base)).rejects.toThrow(
        'Failed to check execution status',
      );
    });

    it('should run in the VPC as the given service account', async () => {
      await executeCloudRunJob(runtime, base);

      const template = mockUpdateJob.mock.calls[0][0].job.template.template;
      expect(template.serviceAccount).toBe(base.serviceAccount);
      expect(template.vpcAccess.networkInterfaces).toEqual([
        { network: base.vpcNetwork, subnetwork: base.vpcSubnet },
      ]);
    });
  });
});
