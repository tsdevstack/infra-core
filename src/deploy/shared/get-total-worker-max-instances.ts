/**
 * Get Total Worker Max Instances
 *
 * Counts pool-relevant workers and multiplies by 3 (hardcoded cap).
 * A worker is pool-relevant if its base service has hasDatabase === true.
 * Workers always run with maxInstances: 3 — this is a framework constant.
 */

import { isPoolRelevant } from './is-pool-relevant.ts';

const WORKER_MAX_INSTANCES = 3;

export function getTotalWorkerMaxInstances(
  services: Array<{
    name: string;
    type: string;
    hasDatabase?: boolean;
    baseService?: string;
  }>,
): number {
  const poolRelevantWorkers = services.filter(
    (s) => s.type === 'worker' && isPoolRelevant(s, services),
  );

  return poolRelevantWorkers.length * WORKER_MAX_INSTANCES;
}
