/**
 * Cloud capacity errors
 *
 * Errors that mean the provider has no capacity right now for the requested
 * size in the region or zone. They are not configuration errors: each
 * provider's docs say to retry later, or to pick another size or zone.
 *
 * - GCP: Cloud SQL `ERROR_GCE_STOCKOUT`, "The zone or region doesn't have
 *   sufficient resources to handle the request at the moment" (Admin API
 *   error messages; the troubleshooting page spells it "does not have").
 *   Memorystore documents no capacity error.
 * - AWS: RDS `InsufficientDBInstanceCapacity`, ElastiCache
 *   `InsufficientCacheClusterCapacity`.
 * - Azure: `RegionalAllocationFailed` (PostgreSQL Flexible Server),
 *   `ZonalAllocationFailed` and `AllocationFailed` (compute allocation).
 */

import type { CloudProvider } from '../types/credentials.ts';

export const CLOUD_CAPACITY_ERROR_PATTERNS: Readonly<
  Record<CloudProvider, readonly RegExp[]>
> = {
  gcp: [
    /\bERROR_GCE_STOCKOUT\b/,
    /sufficient resources to handle the request at the moment/i,
  ],
  aws: [
    /\bInsufficientDBInstanceCapacity\b/,
    /\bInsufficientCacheClusterCapacity\b/,
  ],
  azure: [/\b(?:Regional|Zonal)?AllocationFailed\b/],
};
