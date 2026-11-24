import { describe, it, expect, rs, beforeEach } from '@rstest/core';

const { mockRunJob, mockGetExecution, mockFetchJobLogs } = rs.hoisted(() => ({
  mockRunJob: rs.fn(),
  mockGetExecution: rs.fn(),
  mockFetchJobLogs: rs.fn(async (..._args: unknown[]) => 'container logs'),
}));

rs.mock('@google-cloud/run', () => ({
  JobsClient: class {
    runJob = mockRunJob;
  },
  ExecutionsClient: class {
    getExecution = mockGetExecution;
  },
}));
rs.mock('./fetch-cloud-run-logs.ts', () => ({
  fetchJobLogs: (...args: unknown[]) => mockFetchJobLogs(...args),
}));
rs.mock('../../utils/async/sleep.ts', () => ({
  sleep: rs.fn(async () => {}),
}));

import { runCloudRunJobAndWait } from './run-cloud-run-job-and-wait';

const runtime = {
  logger: { info: rs.fn(), success: rs.fn(), warn: rs.fn(), error: rs.fn() },
} as unknown as Parameters<typeof runCloudRunJobAndWait>[0];

const options = {
  projectId: 'gcp-shop',
  region: 'europe-west1',
  jobName: 'shop-cron-usage-report',
  credentials: {
    project_id: 'gcp-shop',
    region: 'europe-west1',
    client_email: 'x@gcp-shop.iam.gserviceaccount.com',
    private_key: 'k',
  },
  timeoutSeconds: 660,
};

const execution =
  'projects/gcp-shop/locations/europe-west1/jobs/shop-cron-usage-report/executions/e1';

describe('runCloudRunJobAndWait', () => {
  beforeEach(() => {
    rs.clearAllMocks();
    mockRunJob.mockResolvedValue([
      {
        metadata: { name: execution },
        promise: async () => [{ name: execution }],
      },
    ]);
  });

  it('should run the job and report a succeeded execution', async () => {
    mockGetExecution.mockResolvedValue([
      { completionTime: {}, succeededCount: 1, failedCount: 0 },
    ]);

    const result = await runCloudRunJobAndWait(runtime, options);

    expect(mockRunJob).toHaveBeenCalledWith({
      name: 'projects/gcp-shop/locations/europe-west1/jobs/shop-cron-usage-report',
    });
    expect(result).toEqual({
      success: true,
      logs: `Execution ${execution} completed successfully`,
      executionName: execution,
    });
  });

  it("should fetch the logs of a failed execution and give Cloud Run's reason", async () => {
    mockGetExecution.mockResolvedValue([
      {
        completionTime: {},
        succeededCount: 0,
        failedCount: 1,
        conditions: [
          { type: 'Started', message: 'Started deployed execution in 5s.' },
          {
            type: 'Completed',
            message:
              'Task e1-task0 failed with exit code: 1 and message: The container exited with an error.',
          },
        ],
      },
    ]);

    const result = await runCloudRunJobAndWait(runtime, options);

    expect(result).toEqual({
      success: false,
      logs: 'container logs',
      executionName: execution,
      reason:
        'Task e1-task0 failed with exit code: 1 and message: The container exited with an error.',
    });
    expect(mockFetchJobLogs).toHaveBeenCalledWith(options, execution);
  });

  it('should leave the logs to the caller with readLogs false', async () => {
    mockGetExecution.mockResolvedValue([
      {
        completionTime: {},
        succeededCount: 0,
        failedCount: 1,
        conditions: [{ type: 'Completed', message: 'exit code: 1' }],
      },
    ]);

    const result = await runCloudRunJobAndWait(runtime, {
      ...options,
      readLogs: false,
    });

    expect(result).toEqual({
      success: false,
      logs: '',
      executionName: execution,
      reason: 'exit code: 1',
    });
    expect(mockFetchJobLogs).not.toHaveBeenCalled();
  });

  it('should report a failure the start operation itself answers with', async () => {
    mockRunJob.mockResolvedValue([
      {
        metadata: { name: execution },
        promise: async () => {
          throw new Error('Execution e1 has failed to complete');
        },
      },
    ]);

    const result = await runCloudRunJobAndWait(runtime, {
      ...options,
      readLogs: false,
    });

    expect(result).toEqual({
      success: false,
      logs: '',
      executionName: execution,
      reason: 'Execution e1 has failed to complete',
    });
    expect(mockFetchJobLogs).not.toHaveBeenCalled();
    expect(mockGetExecution).not.toHaveBeenCalled();
  });

  it('should keep reading while the execution runs', async () => {
    mockGetExecution
      .mockResolvedValueOnce([{}])
      .mockResolvedValueOnce([
        { completionTime: {}, succeededCount: 1, failedCount: 0 },
      ]);

    const result = await runCloudRunJobAndWait(runtime, options);

    expect(mockGetExecution).toHaveBeenCalledTimes(2);
    expect(result.success).toBe(true);
  });

  it("should wrap a refused start, with the API's error as the cause", async () => {
    // A gRPC error as google-gax gives it: the code on the error
    const apiError = Object.assign(
      new Error('5 NOT_FOUND: Resource not found'),
      { code: 5 },
    );
    mockRunJob.mockRejectedValue(apiError);

    await expect(runCloudRunJobAndWait(runtime, options)).rejects.toMatchObject(
      {
        name: 'InfraCoreError',
        message: 'Failed to execute Cloud Run Job: shop-cron-usage-report',
        context: 'cloud-run-jobs',
        hint: '5 NOT_FOUND: Resource not found',
        cause: apiError,
      },
    );
  });
});
