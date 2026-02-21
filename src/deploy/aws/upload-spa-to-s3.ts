/**
 * Upload SPA build artifacts to S3
 *
 * Uploads all files from a build directory to an S3 bucket
 * with appropriate cache headers for optimal CloudFront performance.
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  S3Client,
  PutObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} from '@aws-sdk/client-s3';
import type { AWSCredentials } from '../../types/credentials.ts';
import type { InfraCoreRuntime } from '../../types/runtime.ts';
import { getMimeType } from '../../utils/fs/get-mime-type.ts';
import { getCacheControl } from '../../utils/fs/get-cache-control.ts';
import { getAllFiles } from '../../utils/fs/get-all-files.ts';

export interface UploadSpaToS3Options {
  /** S3 bucket name */
  bucketName: string;
  /** Local directory containing build artifacts */
  sourceDir: string;
  /** AWS credentials */
  credentials: AWSCredentials;
}

export interface UploadSpaToS3Result {
  /** Number of files uploaded */
  filesUploaded: number;
  /** Number of files deleted (stale) */
  filesDeleted: number;
}

/**
 * Upload SPA build artifacts to S3
 */
export async function uploadSpaToS3(
  runtime: InfraCoreRuntime,
  options: UploadSpaToS3Options,
): Promise<UploadSpaToS3Result> {
  const { bucketName, sourceDir, credentials } = options;

  // Build S3 client config
  const clientConfig: {
    region: string;
    credentials?: { accessKeyId: string; secretAccessKey: string };
  } = {
    region: credentials.region,
  };

  // Only set explicit credentials in local mode
  if (!runtime.isCIEnv()) {
    clientConfig.credentials = {
      accessKeyId: credentials.accessKeyId,
      secretAccessKey: credentials.secretAccessKey,
    };
  }

  const s3 = new S3Client(clientConfig);

  // Get all local files
  const localFiles = getAllFiles(sourceDir);
  runtime.logger.info(`Found ${localFiles.length} files to upload`);

  // Get existing files in bucket
  const existingFileNames = new Set<string>();
  let continuationToken: string | undefined;

  do {
    const listResponse = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucketName,
        ContinuationToken: continuationToken,
      }),
    );

    for (const obj of listResponse.Contents ?? []) {
      if (obj.Key) {
        existingFileNames.add(obj.Key);
      }
    }

    continuationToken = listResponse.NextContinuationToken;
  } while (continuationToken);

  // Upload all local files
  let filesUploaded = 0;
  for (const relativePath of localFiles) {
    const localPath = path.join(sourceDir, relativePath);
    const contentType = getMimeType(relativePath);
    const cacheControl = getCacheControl(relativePath);
    const fileContent = fs.readFileSync(localPath);

    await s3.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: relativePath,
        Body: fileContent,
        ContentType: contentType,
        CacheControl: cacheControl,
      }),
    );

    filesUploaded++;
    existingFileNames.delete(relativePath);
  }

  // Delete stale files (files in bucket but not in local build)
  let filesDeleted = 0;
  const staleFiles = Array.from(existingFileNames);

  if (staleFiles.length > 0) {
    // S3 DeleteObjects can handle up to 1000 objects at a time
    const batchSize = 1000;
    for (let i = 0; i < staleFiles.length; i += batchSize) {
      const batch = staleFiles.slice(i, i + batchSize);

      await s3.send(
        new DeleteObjectsCommand({
          Bucket: bucketName,
          Delete: {
            Objects: batch.map((key) => ({ Key: key })),
          },
        }),
      );

      filesDeleted += batch.length;
    }

    runtime.logger.info(`Deleted ${filesDeleted} stale files`);
  }

  return { filesUploaded, filesDeleted };
}
