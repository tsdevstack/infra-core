/**
 * GCP Cloud SQL Database Tiers and Connection Limits
 *
 * Maps Cloud SQL tier names to their maximum connection limits.
 * Used to calculate appropriate connection pool sizes for Cloud Run services.
 */

export const GCP_DATABASE_CONNECTION_LIMITS: Record<string, number> = {
  'db-f1-micro': 25,
  'db-g1-small': 50,
  'db-n1-standard-1': 100,
  'db-n1-standard-2': 200,
  'db-n1-standard-4': 400,
  'db-n1-standard-8': 800,
  'db-n1-standard-16': 1600,
};

export const DEFAULT_DATABASE_TIER = 'db-f1-micro';
