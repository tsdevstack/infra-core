/**
 * Calculate database connection pool size per instance
 *
 * Flat split model: every instance (service or worker) gets the same
 * share of database connections.
 *
 * totalUsable = floor(dbConnections * 0.90)   (10% reserved for admin/migrations)
 * totalInstances = totalServiceMaxInstances + totalWorkerMaxInstances
 * poolMax = floor(totalUsable / totalInstances)
 */

import { InfraCoreError } from '../../runtime/infra-core-error.ts';
import { GCP_DATABASE_CONNECTION_LIMITS } from '../../constants/gcp-database-tiers.ts';
import { AWS_DATABASE_CONNECTION_LIMITS } from '../../constants/aws-database-tiers.ts';
import { AZURE_DATABASE_CONNECTION_LIMITS } from '../../constants/azure-database-tiers.ts';

interface CalculatePoolSizeConfig {
  dbTier: string;
  provider: 'gcp' | 'aws' | 'azure';
  totalServiceMaxInstances: number;
  totalWorkerMaxInstances: number;
}

interface CalculatePoolSizeResult {
  poolMax: number;
  totalUsable: number;
  totalInstances: number;
  dbConnections: number;
}

export function calculatePoolSize(
  config: CalculatePoolSizeConfig,
): CalculatePoolSizeResult {
  const connectionLimits =
    config.provider === 'aws'
      ? AWS_DATABASE_CONNECTION_LIMITS
      : config.provider === 'azure'
        ? AZURE_DATABASE_CONNECTION_LIMITS
        : GCP_DATABASE_CONNECTION_LIMITS;

  const dbConnections = connectionLimits[config.dbTier];

  if (!dbConnections) {
    throw new InfraCoreError(
      `Unknown database tier: ${config.dbTier}`,
      'calculate-pool-size',
      `Valid ${config.provider} tiers: ${Object.keys(connectionLimits).join(', ')}`,
    );
  }

  const totalUsable = Math.floor(dbConnections * 0.9);
  const totalInstances =
    config.totalServiceMaxInstances + config.totalWorkerMaxInstances;

  if (totalInstances === 0) {
    throw new InfraCoreError(
      'No pool-relevant instances found',
      'calculate-pool-size',
      'Ensure at least one service or worker has hasDatabase: true',
    );
  }

  const poolMax = Math.max(Math.floor(totalUsable / totalInstances), 1);

  return { poolMax, totalUsable, totalInstances, dbConnections };
}
