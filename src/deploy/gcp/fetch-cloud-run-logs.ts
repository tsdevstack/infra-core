/**
 * Fetch Cloud Run Job logs from Cloud Logging
 */

import { Logging } from '@google-cloud/logging';
import type { GCPCredentials } from '../../types/credentials.ts';
import { buildGCPClientOptions } from '../../utils/gcp/build-gcp-client-options.ts';
import { sleep } from '../../utils/async/sleep.ts';

import { formatLogEntries } from './format-log-entries.ts';

/** What the logs of a job execution are looked up by */
export interface CloudRunJobLogsTarget {
  projectId: string;
  region: string;
  jobName: string;
  credentials: GCPCredentials;
}

/**
 * Fetch logs for a failed Cloud Run Job execution
 * Returns formatted logs showing what went wrong in the container: its
 * newest 100 lines, oldest first. Cloud Run's audit entries for the job are
 * left out (their payload is a protobuf, not a log line).
 */
export async function fetchJobLogs(
  options: CloudRunJobLogsTarget,
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
    'NOT logName:"cloudaudit.googleapis.com"',
  ];
  if (executionId) {
    filterParts.push(
      `labels."run.googleapis.com/execution_name"="${executionId}"`,
    );
  }
  const filter = filterParts.join(' AND ');

  try {
    // Wait a moment for logs to propagate to Cloud Logging
    await sleep(3000);

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
        'NOT logName:"cloudaudit.googleapis.com"',
      ].join(' AND ');

      const [broadEntries] = await logging.getEntries({
        filter: broadFilter,
        pageSize: 100,
        orderBy: 'timestamp desc',
      });

      if (broadEntries.length === 0) {
        return `No logs found for job ${options.jobName}. Check GCP Console: https://console.cloud.google.com/run/jobs/details/${options.region}/${options.jobName}/executions?project=${options.projectId}`;
      }

      // Format all available logs, oldest first
      return formatLogEntries([...broadEntries].reverse());
    }

    // Read newest first (the last lines matter most), shown oldest first
    return formatLogEntries([...entries].reverse());
  } catch (error) {
    return `Failed to fetch logs: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}
