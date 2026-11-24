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

// ---------------------------------------------------------------------------
// Cron jobs: the other kind of scheduled job, a run of the service's image
// ---------------------------------------------------------------------------

/** `type` values of a scheduledJobs entry; an entry without one is a trigger */
export const SCHEDULED_JOB_TYPES = ['trigger', 'cron'] as const;

/** `type` of a cron job entry */
export const CRON_JOB_TYPE = 'cron';

/** `type` of a trigger entry (optional in the config) */
export const TRIGGER_JOB_TYPE = 'trigger';

/**
 * Seconds the platform's own timeout (Cloud Run task timeout, Container App
 * Job replicaTimeout) runs past the job's timeout. The platform counts from
 * the container's start, the runner from after the module booted, so the
 * platform would reach the job's timeout first; the margin covers the boot,
 * the runner's 8 s grace and its 1 s lock release, so the runner always
 * stops first and the platform's kill only matters for a stuck process.
 */
export const CRON_JOB_PLATFORM_TIMEOUT_MARGIN_SECONDS = 60;

/**
 * How long a cron job's run may take (timeout, in seconds), per cloud, and
 * the value used when the job sets none. GCP: Cloud Run's task timeout is at
 * most 7 days (604800 s), and the platform gets the job's timeout plus
 * CRON_JOB_PLATFORM_TIMEOUT_MARGIN_SECONDS, so the config takes that much
 * less. AWS and Azure document no limit; the framework caps a run at a day,
 * since a job past a day is stuck. The runner (nest-common's runCronJob)
 * stops the run itself at the timeout, so it means the same everywhere, and
 * locally.
 */
export const CRON_JOB_TIMEOUT = {
  gcp: {
    min: 1,
    max: 604800 - CRON_JOB_PLATFORM_TIMEOUT_MARGIN_SECONDS,
    default: 600,
  },
  aws: { min: 1, max: 86400, default: 600 },
  azure: { min: 1, max: 86400, default: 600 },
} as const;

/** Prefix of a cron job's cloud resources: `{project}-cron-{name}` (next to `migrate-{service}`) */
export const CRON_JOB_NAME_PREFIX = 'cron-';

/** The command a cron job's container runs (the service's image) */
export const CRON_JOB_COMMAND = ['node', 'dist/cron.js'] as const;

/** The cron job's name, in its container's environment (nest-common's CRON_JOB_NAME_ENV) */
export const CRON_JOB_NAME_ENV = 'CRON_JOB_NAME';

/** The cron job's timeout in seconds, in its container's environment (nest-common's CRON_JOB_TIMEOUT_ENV) */
export const CRON_JOB_TIMEOUT_ENV = 'CRON_JOB_TIMEOUT';

/**
 * The last log line of every run (nest-common's CRON_FINISHED_MESSAGE), with
 * `outcome`, `exitCode` and `durationMs`; read where the platform keeps no
 * run history (AWS)
 */
export const CRON_FINISHED_MESSAGE = 'cron job finished';

/**
 * A cron job's name: kebab-case (lowercase letters, digits, single hyphens,
 * starting with a letter, ending with a letter or digit), at most 40
 * characters. It names the handler file, its class and the cloud job
 * resources. The same rule as cli-core's validateCronJobName (a test keeps
 * the two equal).
 */
export const CRON_JOB_NAME_PATTERN = /^[a-z][a-z0-9-]*[a-z0-9]$/;
export const CRON_JOB_NAME_MAX_LENGTH = 40;

/** Where a service keeps its cron job entrypoint and handlers (the CLI's templates) */
export const CRON_ENTRY_FILE = 'src/cron.ts';
export const CRON_HANDLER_DIR = 'src/cron';
export const CRON_HANDLER_SUFFIX = '.cron.ts';
