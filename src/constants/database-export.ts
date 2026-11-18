/**
 * Saving a service's database (infra:remove-service, infra:restore-database)
 */

/** Days a saved file stays in the exports bucket (its lifecycle rule) */
export const DB_EXPORT_RETENTION_DAYS = 7;

/** Time limit of the database job when it saves or restores, in seconds */
export const DB_EXPORT_JOB_TIMEOUT_SECONDS = 60 * 60;

/**
 * Why a file was saved, in its name: {service}/{time}-{reason}.dump. The
 * restore takes the newest `removed` file by default, never a
 * `before-restore` one.
 */
export const DB_EXPORT_REASONS = {
  removed: 'removed',
  beforeRestore: 'before-restore',
} as const;

/** Azure: the container of saved databases, in its own storage account */
export const DB_EXPORT_AZURE_CONTAINER = 'db-exports';

/** Extension of a saved file (pg_dump's custom format) */
export const DB_EXPORT_FILE_EXTENSION = '.dump';

/**
 * Postgres major version of each cloud's database server. The db-init image
 * is built on the official postgres image of that version, so its pg_dump
 * and pg_restore match the server.
 */
export const DB_SERVER_POSTGRES_VERSION = {
  gcp: '15',
  aws: '15',
  azure: '16',
} as const;
