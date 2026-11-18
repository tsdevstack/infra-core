/**
 * Build the S3 bucket name of a storage bucket
 */

/**
 * S3 bucket names are unique worldwide: the AWS account ID keeps two
 * projects with the same name apart.
 *
 * @param options.projectName - Project name from config.json
 * @param options.bucket - Bucket name from config.json (e.g. avatars)
 * @param options.environment - Environment (dev, staging, prod, ...)
 * @param options.accountId - The environment's AWS account ID
 * @returns `{project}-{bucket}-{env}-{accountId}`
 */
export function buildS3StorageBucketName(options: {
  projectName: string;
  bucket: string;
  environment: string;
  accountId: string;
}): string {
  return `${options.projectName}-${options.bucket}-${options.environment}-${options.accountId}`;
}
