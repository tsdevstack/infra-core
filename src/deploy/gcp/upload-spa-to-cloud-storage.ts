/**
 * Upload SPA build artifacts to Cloud Storage
 *
 * Uploads all files from a build directory to a Cloud Storage bucket
 * with appropriate cache headers for optimal CDN performance.
 */

import { Storage } from '@google-cloud/storage';
import path from 'node:path';
import type { GCPCredentials } from '../../types/credentials.ts';
import type { InfraCoreRuntime } from '../../types/runtime.ts';
import { buildGCPClientOptions } from '../../utils/gcp/build-gcp-client-options.ts';
import { getMimeType } from '../../utils/fs/get-mime-type.ts';
import { getCacheControl } from '../../utils/fs/get-cache-control.ts';
import { getAllFiles } from '../../utils/fs/get-all-files.ts';

export interface UploadSpaOptions {
  /** Cloud Storage bucket name */
  bucketName: string;
  /** Local directory containing build artifacts */
  sourceDir: string;
  /** GCP credentials */
  credentials: GCPCredentials;
}

export interface UploadSpaResult {
  /** Number of files uploaded */
  filesUploaded: number;
  /** Number of files deleted (stale) */
  filesDeleted: number;
}

/**
 * Upload SPA build artifacts to Cloud Storage
 */
export async function uploadSpaToCloudStorage(
  runtime: InfraCoreRuntime,
  options: UploadSpaOptions,
): Promise<UploadSpaResult> {
  const { bucketName, sourceDir, credentials } = options;

  // Initialize storage client (supports ADC mode)
  const storage = new Storage(buildGCPClientOptions(credentials));

  const bucket = storage.bucket(bucketName);

  // Get all local files
  const localFiles = getAllFiles(sourceDir);
  runtime.logger.info(`Found ${localFiles.length} files to upload`);

  // Get existing files in bucket
  const [existingFiles] = await bucket.getFiles();
  const existingFileNames = new Set(existingFiles.map((f) => f.name));

  // Upload all local files
  let filesUploaded = 0;
  for (const relativePath of localFiles) {
    const localPath = path.join(sourceDir, relativePath);
    const contentType = getMimeType(relativePath);
    const cacheControl = getCacheControl(relativePath);

    await bucket.upload(localPath, {
      destination: relativePath,
      metadata: {
        contentType,
        cacheControl,
      },
    });

    filesUploaded++;
    existingFileNames.delete(relativePath);
  }

  // Delete stale files (files in bucket but not in local build)
  let filesDeleted = 0;
  for (const staleName of Array.from(existingFileNames)) {
    await bucket.file(staleName).delete();
    filesDeleted++;
  }

  if (filesDeleted > 0) {
    runtime.logger.info(`Deleted ${filesDeleted} stale files`);
  }

  return { filesUploaded, filesDeleted };
}
