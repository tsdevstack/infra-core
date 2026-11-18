/**
 * Scheduled jobs: the HTTP call each run makes to its service
 */

/** HTTP method of a job's call when the job sets none */
export const DEFAULT_SCHEDULED_JOB_METHOD = 'POST';

/**
 * Time zone a job's schedule runs in when the job sets none. GCP (Cloud
 * Scheduler) and AWS (EventBridge Scheduler) take any IANA zone; Azure
 * Container Apps jobs run their schedule in UTC only.
 */
export const DEFAULT_SCHEDULED_JOB_TIMEZONE = 'UTC';

/**
 * How long a job's call may take (httpTimeout, in seconds), per cloud, and the
 * value used when the job sets none.
 *
 * - GCP: Cloud Scheduler's attempt deadline for HTTP targets, 15 s to 30 min.
 * - AWS: the invoker Lambda waits httpTimeout, then needs a few seconds
 *   (AWS_JOB_INVOKER_LOG_SECONDS) to log the run's end before Lambda's 900 s
 *   limit stops it.
 * - Azure: Container Apps ingress ends every HTTP request at 240 s, and the
 *   job reaches its service through ingress.
 *
 * The 15 s minimum is Cloud Scheduler's; the other clouds use it too, so a
 * config means the same everywhere.
 */
export const SCHEDULED_JOB_HTTP_TIMEOUT = {
  gcp: { min: 15, max: 1800, default: 300 },
  aws: { min: 15, max: 890, default: 300 },
  azure: { min: 15, max: 240, default: 240 },
} as const;

/** Seconds the AWS invoker Lambda runs past a job's httpTimeout, to log the end */
export const AWS_JOB_INVOKER_LOG_SECONDS = 10;
