/**
 * Build the Cloud Run name of a service, worker or job
 */

import type { NamingScheme } from '../../types/config.ts';

/**
 * Cloud Run names are unique per GCP project and region. In the unique
 * scheme they carry the project (`{project}-{name}`), so two tsdevstack
 * projects in one GCP project don't replace each other's services. Legacy
 * environments keep the bare name.
 *
 * Kong is named `{project}-kong` in both schemes: it doesn't use this.
 *
 * @param projectName - Project name from config.json
 * @param name - Service, worker or job name (e.g. auth-service, migrate-auth-service)
 * @param naming - The environment's naming scheme
 * @returns The Cloud Run (or Cloud Scheduler) name
 */
export function buildGcpCloudRunName(
  projectName: string,
  name: string,
  naming: NamingScheme,
): string {
  return naming === 'unique' ? `${projectName}-${name}` : name;
}
