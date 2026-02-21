/**
 * Get Total Service Max Instances
 *
 * Sums maxInstances across all pool-relevant non-worker services.
 * A service is pool-relevant if it has hasDatabase === true.
 * Used by calculatePoolSize() to determine per-instance pool size.
 *
 * Accepts a getMaxInstances callback so callers can resolve service
 * configuration from their own config layer (e.g., infrastructure.json).
 */

import { isPoolRelevant } from './is-pool-relevant.ts';

export function getTotalServiceMaxInstances(
  services: Array<{
    name: string;
    type: string;
    hasDatabase?: boolean;
    baseService?: string;
  }>,
  getMaxInstances: (serviceName: string) => number,
): number {
  const poolRelevantServices = services.filter(
    (s) => s.type !== 'worker' && isPoolRelevant(s, services),
  );

  let total = 0;
  for (const service of poolRelevantServices) {
    total += getMaxInstances(service.name);
  }

  return total;
}
