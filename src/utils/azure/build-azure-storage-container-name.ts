/**
 * Build the Azure Blob container name of a storage bucket
 */

/**
 * Each bucket is a container in the environment's storage account:
 * `{project}-{bucket}-{env}`. Container names are unique only within their
 * account (already unique worldwide), so they carry no account suffix.
 *
 * @param options.projectName - Project name from config.json
 * @param options.bucket - Bucket name from config.json (e.g. avatars)
 * @param options.environment - Environment (dev, staging, prod, ...)
 * @returns The container name
 */
export function buildAzureStorageContainerName(options: {
  projectName: string;
  bucket: string;
  environment: string;
}): string {
  return `${options.projectName}-${options.bucket}-${options.environment}`;
}
