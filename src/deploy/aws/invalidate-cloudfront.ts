/**
 * Invalidate CloudFront Distribution
 *
 * Creates a cache invalidation for a CloudFront distribution.
 * Used after SPA deployment to ensure users get the latest version.
 */

import {
  CloudFrontClient,
  CreateInvalidationCommand,
} from '@aws-sdk/client-cloudfront';
import type { AWSCredentials } from '../../types/credentials.ts';
import type { InfraCoreRuntime } from '../../types/runtime.ts';
import { InfraCoreError } from '../../runtime/infra-core-error.ts';

export interface InvalidateCloudfrontOptions {
  /** CloudFront distribution ID */
  distributionId: string;
  /** Paths to invalidate (defaults to ['/*'] for all) */
  paths?: string[];
  /** AWS credentials */
  credentials: AWSCredentials;
}

export interface InvalidateCloudfrontResult {
  invalidationId?: string;
}

/**
 * Create a CloudFront cache invalidation
 */
export async function invalidateCloudfront(
  runtime: InfraCoreRuntime,
  options: InvalidateCloudfrontOptions,
): Promise<InvalidateCloudfrontResult> {
  const { distributionId, paths = ['/*'], credentials } = options;

  // Build CloudFront client config
  const clientConfig: {
    region: string;
    credentials?: { accessKeyId: string; secretAccessKey: string };
  } = {
    region: 'us-east-1', // CloudFront is global, uses us-east-1
  };

  // Only set explicit credentials in local mode
  if (!runtime.isCIEnv()) {
    clientConfig.credentials = {
      accessKeyId: credentials.accessKeyId,
      secretAccessKey: credentials.secretAccessKey,
    };
  }

  const cloudfront = new CloudFrontClient(clientConfig);

  try {
    const response = await cloudfront.send(
      new CreateInvalidationCommand({
        DistributionId: distributionId,
        InvalidationBatch: {
          CallerReference: `spa-deploy-${Date.now()}`,
          Paths: {
            Quantity: paths.length,
            Items: paths,
          },
        },
      }),
    );

    return {
      invalidationId: response.Invalidation?.Id,
    };
  } catch (err: unknown) {
    throw new InfraCoreError(
      'Failed to create CloudFront invalidation',
      'cloudfront',
      err instanceof Error ? err.message : 'Unknown error',
    );
  }
}
