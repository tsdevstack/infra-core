/**
 * Cloud Run Jobs utility for running migrations
 *
 * Uses @google-cloud/run to create/update and execute Cloud Run Jobs
 * with Direct VPC Egress for database access via Private Service Access.
 */

import { JobsClient, ExecutionsClient } from '@google-cloud/run';
import type { InfraCoreRuntime } from '../../types/runtime.ts';
import type { GCPCredentials } from '../../types/credentials.ts';
import { InfraCoreError } from '../../runtime/infra-core-error.ts';
import { buildGCPClientOptions } from '../../utils/gcp/build-gcp-client-options.ts';
import { sleep } from '../../utils/async/sleep.ts';
import { fetchJobLogs } from './fetch-cloud-run-logs.ts';

export interface CloudRunJobOptions {
  projectId: string;
  region: string;
  jobName: string;
  imageUri: string;
  command: string[];
  // Direct VPC Egress - job gets IP directly in subnet
  vpcNetwork: string; // e.g., "projects/xxx/global/networks/tsdevstack-vpc"
  vpcSubnet: string; // e.g., "projects/xxx/regions/us-central1/subnetworks/tsdevstack-subnet"
  secretName: string;
  serviceAccount: string;
  credentials: GCPCredentials;
  /** CPU allocation (default: '1') */
  cpu?: string;
  /** Memory allocation (default: '2Gi') */
  memory?: string;
}

export interface CloudRunJobResult {
  success: boolean;
  logs: string;
}

/**
 * Create or update a Cloud Run Job, execute it, and wait for completion
 */
export async function executeCloudRunJob(
  runtime: InfraCoreRuntime,
  options: CloudRunJobOptions,
): Promise<CloudRunJobResult> {
  const clientOptions = buildGCPClientOptions(options.credentials);
  const jobsClient = new JobsClient(clientOptions);
  const executionsClient = new ExecutionsClient(clientOptions);

  const parent = `projects/${options.projectId}/locations/${options.region}`;
  const jobName = `${parent}/jobs/${options.jobName}`;

  // Job configuration
  const jobConfig = {
    name: jobName,
    template: {
      template: {
        serviceAccount: options.serviceAccount,
        containers: [
          {
            image: options.imageUri,
            command: options.command,
            env: [
              {
                name: 'DATABASE_URL',
                valueSource: {
                  secretKeyRef: {
                    // Secret name - Cloud Run resolves it within the same project
                    secret: options.secretName,
                    version: 'latest',
                  },
                },
              },
            ],
            resources: {
              limits: {
                cpu: options.cpu ?? '1',
                memory: options.memory ?? '2Gi',
              },
            },
          },
        ],
        vpcAccess: {
          networkInterfaces: [
            {
              network: options.vpcNetwork,
              subnetwork: options.vpcSubnet,
            },
          ],
          egress: 'PRIVATE_RANGES_ONLY' as const,
        },
        maxRetries: 0,
        timeout: { seconds: 300 },
      },
    },
  };

  // Create or update job using allowMissing flag
  runtime.logger.info(`Creating/updating Cloud Run Job: ${options.jobName}...`);
  try {
    const [updateOperation] = await jobsClient.updateJob({
      job: jobConfig,
      allowMissing: true,
    });
    await updateOperation.promise();
  } catch (error) {
    throw new InfraCoreError(
      `Failed to create/update Cloud Run Job: ${options.jobName}`,
      'cloud-run-jobs',
      error instanceof Error ? error.message : 'Unknown error',
    );
  }

  // Execute the job
  runtime.logger.info(`Executing Cloud Run Job: ${options.jobName}...`);
  let executionName: string | undefined;
  let executionFailed = false;

  try {
    const [runOperation] = await jobsClient.runJob({ name: jobName });

    // Get execution name from operation metadata
    // The metadata contains the execution resource being created
    const metadata = runOperation.metadata as { name?: string } | undefined;
    if (metadata?.name) {
      executionName = metadata.name;
      runtime.logger.info(`Execution started: ${executionName}`);
    }

    // Wait for operation to complete with timeout
    // GCP SDK's runOperation.promise() can hang even when job succeeds,
    // so we add a 60-second timeout and fall back to polling
    const operationTimeout = 60 * 1000; // 60 seconds
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

      // If it's our timeout, fall through to polling (executionFailed stays false)
      if (errorMsg === 'Operation promise timeout') {
        runtime.logger.info(
          'Operation taking longer than expected, switching to polling...',
        );
        // Continue to polling loop - don't set executionFailed
      } else {
        // Job failed during execution, but we still want to fetch logs
        executionFailed = true;
        // executionName should already be set from metadata
        if (!executionName) {
          // Try to extract execution name from error message
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
    );
  }

  // If job already failed during runOperation.promise(), fetch logs and return
  if (executionFailed && executionName) {
    runtime.logger.info('Job failed. Fetching container logs...');
    const logs = await fetchJobLogs(options, executionName);
    return {
      success: false,
      logs: logs || 'Job execution failed (no logs available)',
    };
  }

  if (!executionName) {
    throw new InfraCoreError(
      `Failed to get execution name for Cloud Run Job: ${options.jobName}`,
      'cloud-run-jobs',
      'Could not determine execution name from operation',
    );
  }

  // Poll for completion
  runtime.logger.info('Waiting for job to complete...');
  const maxWaitTime = 5 * 60 * 1000; // 5 minutes
  const pollInterval = 5000; // 5 seconds
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitTime) {
    try {
      const [execution] = await executionsClient.getExecution({
        name: executionName,
      });

      const completionTime = execution.completionTime;
      if (completionTime) {
        const succeeded = execution.succeededCount === 1;
        const failed = execution.failedCount === 1;

        if (succeeded) {
          runtime.logger.success('Job completed successfully');
          return {
            success: true,
            logs: `Execution ${executionName} completed successfully`,
          };
        }

        if (failed) {
          const errorMessage =
            execution.conditions?.find((c) => c.type === 'Completed')
              ?.message || 'Job execution failed';

          // Fetch container logs to show the actual error
          runtime.logger.info('Fetching container logs...');
          const logs = await fetchJobLogs(options, executionName);

          return {
            success: false,
            logs: logs || errorMessage,
          };
        }
      }

      await sleep(pollInterval);
    } catch (error) {
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
