/**
 * Run an existing Cloud Run Job once and wait for the execution to end
 */

import { JobsClient, ExecutionsClient } from '@google-cloud/run';
import type { InfraCoreRuntime } from '../../types/runtime.ts';
import type { GCPCredentials } from '../../types/credentials.ts';
import { InfraCoreError } from '../../runtime/infra-core-error.ts';
import { buildGCPClientOptions } from '../../utils/gcp/build-gcp-client-options.ts';
import { sleep } from '../../utils/async/sleep.ts';
import { fetchJobLogs } from './fetch-cloud-run-logs.ts';
import { CLOUD_RUN_NO_ANSWER_GRPC_CODES } from '../../constants/cloud-run-deploy-wait.ts';

export interface RunCloudRunJobOptions {
  projectId: string;
  region: string;
  jobName: string;
  credentials: GCPCredentials;
  /** The job's time limit, in seconds; the wait is this plus 2 minutes for the start */
  timeoutSeconds: number;
  /**
   * False when the caller prints a failed run's lines itself (infra:run-cron,
   * in the format of infra:logs): the result's `logs` is then empty.
   * Default: true
   */
  readLogs?: boolean;
}

export interface RunCloudRunJobResult {
  success: boolean;
  logs: string;
  /** The execution's full resource name, when the start answered with one */
  executionName?: string;
  /** Why a failed execution ended, in Cloud Run's words (with the exit code) */
  reason?: string;
}

/**
 * Start one execution and read its status every 5 seconds until it ends.
 * Google's operation promise can hang after the job finished, so a minute
 * after the start the wait switches to polling. A failed execution's
 * container logs are fetched for the result (unless `readLogs` is false),
 * and Cloud Run's reason is in `reason`.
 *
 * @throws InfraCoreError when the run can't be started, the status can't be
 *   read, or the execution doesn't end within the wait. When the start
 *   fails, `cause` is the API's error: its gRPC `code` says why (5,
 *   NOT_FOUND: the job doesn't exist)
 */
export async function runCloudRunJobAndWait(
  runtime: InfraCoreRuntime,
  options: RunCloudRunJobOptions,
): Promise<RunCloudRunJobResult> {
  const clientOptions = buildGCPClientOptions(options.credentials);
  const jobsClient = new JobsClient(clientOptions);
  const executionsClient = new ExecutionsClient(clientOptions);
  const jobName = `projects/${options.projectId}/locations/${options.region}/jobs/${options.jobName}`;
  const { timeoutSeconds } = options;
  const readLogs = options.readLogs ?? true;

  runtime.logger.info(`Executing Cloud Run Job: ${options.jobName}...`);
  let executionName: string | undefined;
  let executionFailed = false;
  let failureReason: string | undefined;

  try {
    const [runOperation] = await jobsClient.runJob({ name: jobName });

    const metadata = runOperation.metadata as { name?: string } | undefined;
    if (metadata?.name) {
      executionName = metadata.name;
      runtime.logger.info(`Execution started: ${executionName}`);
    }

    const operationTimeout = 60 * 1000;
    try {
      const [execution] = await Promise.race([
        runOperation.promise(),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error('Operation promise timeout')),
            operationTimeout,
          ),
        ),
      ]);
      executionName = execution.name!;
      runtime.logger.info('Operation completed, checking job status...');
    } catch (opError) {
      const errorMsg = opError instanceof Error ? opError.message : '';
      if (errorMsg === 'Operation promise timeout') {
        runtime.logger.info(
          'Operation taking longer than expected, switching to polling...',
        );
      } else {
        executionFailed = true;
        failureReason = errorMsg || undefined;
        if (!executionName) {
          const match = errorMsg.match(/executions\/([a-z0-9-]+)/);
          if (match) {
            executionName = `${jobName}/executions/${match[1]}`;
          }
        }
      }
    }
  } catch (error) {
    throw new InfraCoreError(
      `Failed to execute Cloud Run Job: ${options.jobName}`,
      'cloud-run-jobs',
      error instanceof Error ? error.message : 'Unknown error',
      { cause: error },
    );
  }

  if (executionFailed && executionName) {
    if (!readLogs) {
      return {
        success: false,
        logs: '',
        executionName,
        reason: failureReason,
      };
    }
    runtime.logger.info('Job failed. Fetching container logs...');
    const logs = await fetchJobLogs(options, executionName);
    return {
      success: false,
      logs: logs || 'Job execution failed (no logs available)',
      executionName,
      reason: failureReason,
    };
  }

  if (!executionName) {
    throw new InfraCoreError(
      `Failed to get execution name for Cloud Run Job: ${options.jobName}`,
      'cloud-run-jobs',
      'Could not determine execution name from operation',
    );
  }

  runtime.logger.info('Waiting for job to complete...');
  const maxWaitTime = (timeoutSeconds + 120) * 1000;
  const pollInterval = 5000;
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitTime) {
    try {
      const [execution] = await executionsClient.getExecution({
        name: executionName,
      });

      if (execution.completionTime) {
        if (execution.succeededCount === 1) {
          runtime.logger.success('Job completed successfully');
          return {
            success: true,
            logs: `Execution ${executionName} completed successfully`,
            executionName,
          };
        }
        if (execution.failedCount === 1) {
          const reason =
            execution.conditions?.find((c) => c.type === 'Completed')
              ?.message || undefined;
          if (!readLogs) {
            return { success: false, logs: '', executionName, reason };
          }
          runtime.logger.info('Fetching container logs...');
          const logs = await fetchJobLogs(options, executionName);
          return {
            success: false,
            logs: logs || reason || 'Job execution failed',
            executionName,
            reason,
          };
        }
      }

      await sleep(pollInterval);
    } catch (error) {
      // A status check with no answer: the job carries on at Google
      const code = (error as { code?: unknown } | null)?.code;
      if (
        typeof code === 'number' &&
        CLOUD_RUN_NO_ANSWER_GRPC_CODES.includes(code)
      ) {
        await sleep(pollInterval);
        continue;
      }
      throw new InfraCoreError(
        `Failed to check execution status`,
        'cloud-run-jobs',
        error instanceof Error ? error.message : 'Unknown error',
      );
    }
  }

  throw new InfraCoreError(
    'Job execution timed out',
    'cloud-run-jobs',
    `Job did not complete within ${maxWaitTime / 1000} seconds`,
  );
}
