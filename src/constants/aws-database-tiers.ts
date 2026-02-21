/**
 * AWS RDS PostgreSQL Database Tiers and Connection Limits
 *
 * Maps RDS instance class names to their maximum connection limits.
 * Formula: LEAST(DBInstanceClassMemory/9531392, 5000)
 * Used to calculate appropriate connection pool sizes for ECS services.
 */

export const AWS_DATABASE_CONNECTION_LIMITS: Record<string, number> = {
  'db.t3.micro': 112,
  'db.t3.small': 225,
  'db.t3.medium': 450,
  'db.t4g.micro': 112,
  'db.t4g.small': 225,
  'db.t4g.medium': 450,
  'db.r6g.large': 1697,
};

export const DEFAULT_AWS_DATABASE_TIER = 'db.t3.micro';
