/**
 * Cloud Run Jobs utility for running migrations
 *
 * Uses @google-cloud/run to create/update and execute Cloud Run Jobs
 * with Direct VPC Egress for database access via Private Service Access.
 * The two halves, createOrUpdateCloudRunJob and runCloudRunJobAndWait, also
 * serve the cron jobs on their own.
 */

import type { InfraCoreRuntime } from '../../types/runtime.ts';
import {
  createOrUpdateCloudRunJob,
  type CloudRunJobDefinitionOptions,
} from './create-or-update-cloud-run-job.ts';
import { runCloudRunJobAndWait } from './run-cloud-run-job-and-wait.ts';

export type CloudRunJobOptions = CloudRunJobDefinitionOptions;

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
  await createOrUpdateCloudRunJob(runtime, options);
  const { success, logs } = await runCloudRunJobAndWait(runtime, {
    projectId: options.projectId,
    region: options.region,
    jobName: options.jobName,
    credentials: options.credentials,
    timeoutSeconds: options.timeoutSeconds ?? 300,
  });
  return { success, logs };
}
