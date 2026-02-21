/**
 * Wait for Docker image to be available in Artifact Registry
 *
 * After pushing to Artifact Registry, there can be a propagation delay
 * before Cloud Run can find the image. This utility verifies the image exists
 * before attempting deployment, with retry logic.
 *
 * Uses Docker Registry v2 API with Google OAuth2 authentication.
 */

import { google } from 'googleapis';
import type { GCPCredentials } from '../../types/credentials.ts';
import type { InfraCoreRuntime } from '../../types/runtime.ts';
import { InfraCoreError } from '../../runtime/infra-core-error.ts';
import { sleep } from '../../utils/async/sleep.ts';
import { parseImageUri } from './parse-image-uri.ts';

export interface WaitForImageOptions {
  imageUri: string;
  credentials: GCPCredentials;
  maxAttempts?: number;
  delayMs?: number;
}

/**
 * Wait for image to be available in Artifact Registry
 *
 * Uses Docker Registry v2 API with exponential backoff.
 * Throws InfraCoreError if image is not found after max attempts.
 */
export async function waitForImage(
  runtime: InfraCoreRuntime,
  options: WaitForImageOptions,
): Promise<void> {
  const { imageUri, credentials, maxAttempts = 6, delayMs = 2000 } = options;

  runtime.logger.info(`Verifying image availability: ${imageUri}`);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const isAvailable = await checkImageExists(imageUri, credentials);

    if (isAvailable) {
      runtime.logger.success('  Image verified');
      return;
    }

    if (attempt < maxAttempts) {
      const waitTime = delayMs * Math.pow(1.5, attempt - 1);
      runtime.logger.info(
        `  Image not yet available, waiting ${Math.round(waitTime / 1000)}s (attempt ${attempt}/${maxAttempts})...`,
      );
      await sleep(waitTime);
    }
  }

  throw new InfraCoreError(
    `Image not found after ${maxAttempts} attempts: ${imageUri}`,
    'wait-for-image',
    'The image may still be propagating. Wait a moment and try again, or verify the image was pushed successfully.',
  );
}

/**
 * Check if image exists in Artifact Registry using Docker Registry v2 API
 */
async function checkImageExists(
  imageUri: string,
  credentials: GCPCredentials,
): Promise<boolean> {
  const { registry, repository, tag } = parseImageUri(imageUri);

  // Get OAuth2 access token
  const auth = new google.auth.GoogleAuth({
    projectId: credentials.project_id,
    // Only pass credentials if we have a private key (not ADC mode)
    ...(credentials.private_key && {
      credentials: {
        client_email: credentials.client_email,
        private_key: credentials.private_key,
      },
    }),
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  });

  try {
    const accessToken = await auth.getAccessToken();
    if (!accessToken) {
      return false;
    }

    // Docker Registry v2 API: HEAD request to check manifest exists
    // https://docs.docker.com/registry/spec/api/#pulling-an-image-manifest
    const manifestUrl = `https://${registry}/v2/${repository}/manifests/${tag}`;

    const response = await fetch(manifestUrl, {
      method: 'HEAD',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        // Accept all Docker/OCI manifest types including multi-arch indexes
        Accept: [
          'application/vnd.docker.distribution.manifest.v2+json',
          'application/vnd.docker.distribution.manifest.list.v2+json',
          'application/vnd.oci.image.manifest.v1+json',
          'application/vnd.oci.image.index.v1+json',
        ].join(', '),
      },
    });

    // 200 = exists, 404 = not found
    return response.ok;
  } catch {
    return false;
  }
}
