/**
 * Resource naming: how an environment names the resources it creates
 *
 * Environments first deployed before the project carried every name (and
 * an account suffix on names that must be unique worldwide) keep their
 * names: a cloud resource can't be renamed, a new name is a new resource.
 * The CLI reads which scheme an environment uses from its Terraform state
 * and never moves an environment from one to the other.
 */

/**
 * - legacy: the names environments got before the project was in every
 *   name (GCP Cloud Run services and jobs by the service name alone, GCS
 *   storage buckets `{project}-{bucket}-{env}`)
 * - unique: the project in every name, and a short account suffix on names
 *   that must be unique worldwide
 */
export const NAMING_SCHEMES = ['legacy', 'unique'] as const;

/** Terraform output that records the environment's scheme in its state */
export const NAMING_SCHEME_OUTPUT = 'naming_scheme';

/** Characters of the account suffix (hex of a SHA-256 of the account ID) */
export const ACCOUNT_SUFFIX_LENGTH = 6;

/**
 * Longest Cloud Run service name: Google's API takes fewer than 50
 * characters. Google documents no limit for Cloud Run job names; their
 * executions are named `{job}-{token}` and must stay under 63, so jobs are
 * held to the same 49.
 */
export const GCP_CLOUD_RUN_NAME_MAX_LENGTH = 49;

/**
 * Cloud Run gives a service its fixed URL
 * (`https://{name}-{project number}.{region}.run.app`) only when
 * `{name}-{project number}` is at most 63 characters (one DNS label).
 */
export const GCP_RUN_APP_HOST_LABEL_MAX_LENGTH = 63;

/**
 * Cloud Run label that marks a service as one project's in the unique
 * scheme (`tsdevstack-project: {project}`). Discovery keeps only services
 * with the project's label: a name prefix alone would also match a project
 * whose name starts with this one (`shop` and `shop-admin`).
 */
export const GCP_PROJECT_LABEL = 'tsdevstack-project';

/**
 * Cloud Scheduler jobs take no labels: in the unique scheme their
 * description names the project instead (`{prefix}{project}`)
 */
export const GCP_SCHEDULER_PROJECT_DESCRIPTION_PREFIX = 'tsdevstack project: ';

/** Longest GCS bucket name without dots */
export const GCS_BUCKET_NAME_MAX_LENGTH = 63;

/**
 * Azure names unique worldwide, and Microsoft's longest name for each
 * (Azure resource name rules). In the unique scheme they get the
 * subscription's account suffix; a name that passes the limit becomes a
 * trimmed prefix plus a hash of the full name (AZURE_NAME_HASH_LENGTH).
 */
export const AZURE_NAME_MAX_LENGTH = {
  /** Lowercase letters and digits */
  storageAccount: 24,
  /** Letters and digits */
  containerRegistry: 50,
  /** Letters, digits and hyphens (`{name}.azurewebsites.net`) */
  appService: 60,
  /** Letters, digits and hyphens */
  redis: 63,
  /** Lowercase letters, digits and hyphens */
  postgresServer: 63,
  /** Container App Jobs (`{project}-{job}`, `{project}-cron-{job}`): lowercase letters, digits and hyphens */
  containerAppJob: 32,
} as const;

/** Hex characters of the hash that replaces the end of a name too long */
export const AZURE_NAME_HASH_LENGTH = 8;
