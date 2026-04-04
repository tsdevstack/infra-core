/**
 * Get Total Worker Max Instances
 *
 * Sums maxInstances for all pool-relevant workers.
 * A worker is pool-relevant if its base service has hasDatabase === true.
 *
 * When infrastructure config is provided, reads actual maxInstances per worker.
 * Falls back to DEFAULT_WORKER_MAX_INSTANCES (3) when no override exists.
 */

import { isPoolRelevant } from './is-pool-relevant.ts';

const DEFAULT_WORKER_MAX_INSTANCES = 3;

interface WorkerMaxInstancesConfig {
  /** Infrastructure config keyed by environment (or null for defaults) */
  infraConfig?: { [env: string]: unknown } | null;
  /** Target environment (e.g., 'dev', 'staging', 'prod') */
  targetEnv?: string;
}

export function getTotalWorkerMaxInstances(
  services: Array<{
    name: string;
    type: string;
    hasDatabase?: boolean;
    baseService?: string;
  }>,
  config?: WorkerMaxInstancesConfig,
): number {
  const poolRelevantWorkers = services.filter(
    (s) => s.type === 'worker' && isPoolRelevant(s, services),
  );

  return poolRelevantWorkers.reduce((total, worker) => {
    const maxInstances = getWorkerMaxInstances(
      worker.name,
      config?.infraConfig,
      config?.targetEnv,
    );
    return total + maxInstances;
  }, 0);
}

function getWorkerMaxInstances(
  workerName: string,
  infraConfig?: { [env: string]: unknown } | null,
  targetEnv?: string,
): number {
  if (!infraConfig || !targetEnv) {
    return DEFAULT_WORKER_MAX_INSTANCES;
  }

  const envConfig = infraConfig[targetEnv];
  if (!envConfig || typeof envConfig !== 'object') {
    return DEFAULT_WORKER_MAX_INSTANCES;
  }

  const workerOverride = (
    envConfig as Record<string, { maxInstances?: number }>
  )[workerName];
  return workerOverride?.maxInstances ?? DEFAULT_WORKER_MAX_INSTANCES;
}
