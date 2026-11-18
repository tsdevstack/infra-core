/**
 * Build the GCS bucket name of a storage bucket
 */

import type { NamingScheme } from '../../types/config.ts';
import { buildAccountSuffix } from '../naming/build-account-suffix.ts';

/**
 * GCS bucket names are unique worldwide. Legacy environments use
 * `{project}-{bucket}-{env}`, which another tsdevstack project with the
 * same name can already hold; the unique scheme adds the GCP project's
 * account suffix: `{project}-{bucket}-{env}-{suffix}`.
 *
 * @param options.projectName - Project name from config.json
 * @param options.bucket - Bucket name from config.json (e.g. avatars)
 * @param options.environment - Environment (dev, staging, prod, ...)
 * @param options.gcpProjectId - The environment's GCP project ID
 * @param options.naming - The environment's naming scheme
 * @returns The GCS bucket name
 */
export function buildGcsStorageBucketName(options: {
  projectName: string;
  bucket: string;
  environment: string;
  gcpProjectId: string;
  naming: NamingScheme;
}): string {
  const base = `${options.projectName}-${options.bucket}-${options.environment}`;
  return options.naming === 'unique'
    ? `${base}-${buildAccountSuffix(options.gcpProjectId)}`
    : base;
}
