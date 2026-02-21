/**
 * Fetch Cloud Run Job logs from Cloud Logging
 */

import { Logging } from '@google-cloud/logging';
import type { CloudRunJobOptions } from './cloud-run-jobs.ts';
import { buildGCPClientOptions } from '../../utils/gcp/build-gcp-client-options.ts';
import { formatLogEntries } from './format-log-entries.ts';

/**
 * Fetch logs for a failed Cloud Run Job execution
 * Returns formatted logs showing what went wrong in the container
 */
export async function fetchJobLogs(
  options: CloudRunJobOptions,
  executionName: string,
): Promise<string> {
  const logging = new Logging(buildGCPClientOptions(options.credentials));

  // Extract execution ID from full name (e.g., projects/.../executions/exec-id)
  const execMatch = executionName.match(/executions\/([^/]+)$/);
  const executionId = execMatch ? execMatch[1] : null;

  // Build filter to get logs for this specific execution
  const filterParts = [
    'resource.type="cloud_run_job"',
    `resource.labels.job_name="${options.jobName}"`,
    `resource.labels.location="${options.region}"`,
  ];
  if (executionId) {
    filterParts.push(
      `labels."run.googleapis.com/execution_name"="${executionId}"`,
    );
  }
  const filter = filterParts.join(' AND ');

  try {
    // Wait a moment for logs to propagate to Cloud Logging
    await new Promise((resolve) => setTimeout(resolve, 3000));

    const [entries] = await logging.getEntries({
      filter,
      pageSize: 100,
      orderBy: 'timestamp desc',
    });

    if (entries.length === 0) {
      // Try a broader filter without location
      const broadFilter = [
        'resource.type="cloud_run_job"',
        `resource.labels.job_name="${options.jobName}"`,
      ].join(' AND ');

      const [broadEntries] = await logging.getEntries({
        filter: broadFilter,
        pageSize: 100,
        orderBy: 'timestamp desc',
      });

      if (broadEntries.length === 0) {
        return `No logs found for job ${options.jobName}. Check GCP Console: https://console.cloud.google.com/run/jobs/details/${options.region}/${options.jobName}/executions?project=${options.projectId}`;
      }

      // Format all available logs
      return formatLogEntries(broadEntries);
    }

    // Format logs
    return formatLogEntries(entries);
  } catch (error) {
    return `Failed to fetch logs: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}
