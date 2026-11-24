import { describe, it, expect, rs, beforeEach } from '@rstest/core';

const { mockUpdateJob } = rs.hoisted(() => ({ mockUpdateJob: rs.fn() }));

rs.mock('@google-cloud/run', () => ({
  JobsClient: class {
    updateJob = mockUpdateJob;
  },
}));

import { createOrUpdateCloudRunJob } from './create-or-update-cloud-run-job';

const runtime = {
  logger: { info: rs.fn(), success: rs.fn(), warn: rs.fn(), error: rs.fn() },
} as unknown as Parameters<typeof createOrUpdateCloudRunJob>[0];

const options = {
  projectId: 'gcp-shop',
  region: 'europe-west1',
  jobName: 'shop-cron-usage-report',
  imageUri: 'europe-west1-docker.pkg.dev/gcp-shop/shop/auth-service:abc',
  command: ['node', 'dist/cron.js', 'usage-report'],
  vpcNetwork: 'projects/gcp-shop/global/networks/shop-vpc',
  vpcSubnet: 'projects/gcp-shop/regions/europe-west1/subnetworks/shop-subnet',
  serviceAccount: 'shop-auth-service@gcp-shop.iam.gserviceaccount.com',
  credentials: {
    project_id: 'gcp-shop',
    region: 'europe-west1',
    client_email: 'x@gcp-shop.iam.gserviceaccount.com',
    private_key: 'k',
  },
  env: { CRON_JOB_NAME: 'usage-report', CRON_JOB_TIMEOUT: '600' },
  secretEnv: { DATABASE_URL: 'shop-auth-service-DATABASE_URL' },
  cpu: '1',
  memory: '2Gi',
  timeoutSeconds: 660,
  labels: { 'tsdevstack-cron-service': 'auth-service' },
};

describe('createOrUpdateCloudRunJob', () => {
  beforeEach(() => {
    rs.clearAllMocks();
    mockUpdateJob.mockResolvedValue([{ promise: async () => [{}] }]);
  });

  it('should create or update the job with the definition, labels and no retries', async () => {
    const name = await createOrUpdateCloudRunJob(runtime, options);

    expect(name).toBe(
      'projects/gcp-shop/locations/europe-west1/jobs/shop-cron-usage-report',
    );
    const call = mockUpdateJob.mock.calls[0][0];
    expect(call.allowMissing).toBe(true);
    expect(call.job.labels).toEqual({
      'tsdevstack-cron-service': 'auth-service',
    });
    const template = call.job.template.template;
    expect(template.maxRetries).toBe(0);
    expect(template.timeout).toEqual({ seconds: 660 });
    expect(template.serviceAccount).toBe(options.serviceAccount);
    expect(template.containers[0].command).toEqual([
      'node',
      'dist/cron.js',
      'usage-report',
    ]);
    expect(template.containers[0].env).toEqual([
      {
        name: 'DATABASE_URL',
        valueSource: {
          secretKeyRef: {
            secret: 'shop-auth-service-DATABASE_URL',
            version: 'latest',
          },
        },
      },
      { name: 'CRON_JOB_NAME', value: 'usage-report' },
      { name: 'CRON_JOB_TIMEOUT', value: '600' },
    ]);
    expect(template.vpcAccess.egress).toBe('PRIVATE_RANGES_ONLY');
  });

  it('should leave labels out when none are given', async () => {
    const { labels: _labels, ...withoutLabels } = options;
    await createOrUpdateCloudRunJob(runtime, withoutLabels);

    expect(mockUpdateJob.mock.calls[0][0].job).not.toHaveProperty('labels');
  });

  it('should wrap an API refusal', async () => {
    mockUpdateJob.mockRejectedValue(new Error('PERMISSION_DENIED'));

    await expect(createOrUpdateCloudRunJob(runtime, options)).rejects.toThrow(
      'Failed to create/update Cloud Run Job: shop-cron-usage-report',
    );
  });
});
