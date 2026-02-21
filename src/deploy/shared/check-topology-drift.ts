/**
 * Check Topology Drift
 *
 * Compares deployed services (from cloud discovery) against current
 * framework config to detect topology drift. Only compares services
 * that use the database (hasDatabase === true, or workers whose
 * base service has a database).
 *
 * Throws InfraCoreError if topology has drifted.
 * Does nothing if topology matches or nothing is deployed (first deploy).
 */

import { InfraCoreError } from '../../runtime/infra-core-error.ts';
import { isPoolRelevant } from './is-pool-relevant.ts';

export function checkTopologyDrift(params: {
  targetEnv: string;
  deployedServices: Array<{
    name: string;
    type: string;
    resources?: { hasDatabase?: boolean };
  }>;
  configServices: Array<{
    name: string;
    type: string;
    hasDatabase?: boolean;
    baseService?: string;
  }>;
}): void {
  const { targetEnv, deployedServices, configServices } = params;

  // Deployed side: use hasDatabase from discovery resources where available,
  // fall back to type-based inference for providers that don't report it
  const deployedNames = deployedServices
    .filter((s) => {
      if (s.resources?.hasDatabase !== undefined) {
        return s.resources.hasDatabase;
      }
      return s.type === 'nestjs' || s.type === 'backend' || s.type === 'worker';
    })
    .map((s) => s.name)
    .sort();

  // Config side: use hasDatabase + resolve worker base services
  const configNames = configServices
    .filter((s) => isPoolRelevant(s, configServices))
    .map((s) => s.name)
    .sort();

  // First deploy — nothing running, no pool exhaustion risk
  if (deployedNames.length === 0) {
    return;
  }

  // Topology matches — safe to deploy single service
  if (JSON.stringify(deployedNames) === JSON.stringify(configNames)) {
    return;
  }

  const added = configNames.filter((n) => !deployedNames.includes(n));
  const removed = deployedNames.filter((n) => !configNames.includes(n));

  const parts: string[] = [
    'Service topology changed since last full deployment:',
  ];

  if (added.length > 0) {
    parts.push(`  Added (in config but not deployed): ${added.join(', ')}`);
  }
  if (removed.length > 0) {
    parts.push(`  Removed (deployed but not in config): ${removed.join(', ')}`);
  }

  parts.push('');
  parts.push(
    'Database connection pool sizes are calculated based on total service count.',
  );
  parts.push(
    'Deploying a single service now would leave other services with incorrect pool sizes.',
  );
  parts.push('');
  parts.push(
    `Run "npx tsdevstack infra:deploy-services --env ${targetEnv}" to redeploy all services with correct pool sizes.`,
  );

  throw new InfraCoreError(
    parts.join('\n'),
    'topology-check',
    'This is a safety check to prevent database connection pool exhaustion.',
  );
}
