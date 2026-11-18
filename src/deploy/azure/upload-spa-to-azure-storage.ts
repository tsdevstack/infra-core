/**
 * Upload SPA build artifacts to Azure Blob Storage
 *
 * Uploads all files from a build directory to an Azure Storage $web container
 * with appropriate cache headers for optimal CDN performance.
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  BlobServiceClient,
  StorageSharedKeyCredential,
} from '@azure/storage-blob';
import { StorageManagementClient } from '@azure/arm-storage';
import type { TokenCredential } from '@azure/identity';
import type { InfraCoreRuntime } from '../../types/runtime.ts';
import { InfraCoreError } from '../../runtime/infra-core-error.ts';
import { getMimeType } from '../../utils/fs/get-mime-type.ts';
import { getCacheControl } from '../../utils/fs/get-cache-control.ts';
import { getAllFiles } from '../../utils/fs/get-all-files.ts';
import { shouldDeleteOldSpaFile } from '../../utils/fs/should-delete-old-spa-file.ts';

export interface UploadSpaToAzureStorageOptions {
  /** Azure Storage account name */
  storageAccountName: string;
  /** Resource group name (needed to fetch storage account keys) */
  resourceGroupName: string;
  /** Local directory containing build artifacts */
  sourceDir: string;
  /** Azure subscription ID */
  subscriptionId: string;
  /** Azure credential (from createAzureCredential or similar) */
  credential: TokenCredential;
}

export interface UploadSpaToAzureStorageResult {
  /** Number of files uploaded */
  filesUploaded: number;
  /** Files left out of this build and last uploaded more than a day ago: deleted */
  filesDeleted: number;
  /** Files left out of this build but uploaded within a day: kept for now */
  filesKept: number;
}

/**
 * Upload SPA build artifacts to Azure Blob Storage $web container
 */
export async function uploadSpaToAzureStorage(
  runtime: InfraCoreRuntime,
  options: UploadSpaToAzureStorageOptions,
): Promise<UploadSpaToAzureStorageResult> {
  const {
    storageAccountName,
    resourceGroupName,
    sourceDir,
    subscriptionId,
    credential,
  } = options;

  // Use storage account keys instead of RBAC — the service principal
  // has management access but not data-plane RBAC on the storage account
  const storageClient = new StorageManagementClient(credential, subscriptionId);
  const keysResult = await storageClient.storageAccounts.listKeys(
    resourceGroupName,
    storageAccountName,
  );
  const accountKey = keysResult.keys?.[0]?.value;
  if (!accountKey) {
    throw new InfraCoreError(
      `No storage account keys found for "${storageAccountName}"`,
      'upload-spa',
      'Check that the storage account exists and the service principal has access',
    );
  }

  const sharedKeyCredential = new StorageSharedKeyCredential(
    storageAccountName,
    accountKey,
  );
  const blobServiceClient = new BlobServiceClient(
    `https://${storageAccountName}.blob.core.windows.net`,
    sharedKeyCredential,
  );

  const containerClient = blobServiceClient.getContainerClient('$web');

  // Get all local files
  const localFiles = getAllFiles(sourceDir);
  runtime.logger.info(`  Found ${localFiles.length} files to upload`);

  // Get existing blobs, with their last upload time
  const existingBlobNames = new Map<string, Date | undefined>();
  for await (const blob of containerClient.listBlobsFlat()) {
    existingBlobNames.set(blob.name, blob.properties?.lastModified);
  }

  // Upload all local files
  let filesUploaded = 0;
  for (const relativePath of localFiles) {
    const localPath = path.join(sourceDir, relativePath);
    const contentType = getMimeType(relativePath);
    const cacheControl = getCacheControl(relativePath);
    const fileContent = fs.readFileSync(localPath);

    const blockBlobClient = containerClient.getBlockBlobClient(relativePath);
    await blockBlobClient.upload(fileContent, fileContent.length, {
      blobHTTPHeaders: {
        blobContentType: contentType,
        blobCacheControl: cacheControl,
      },
    });

    filesUploaded++;
    existingBlobNames.delete(relativePath);
  }

  // Blobs left out of this build: deleted once their last upload is more
  // than a day old, so a visitor with the previous version open can still
  // load its files
  const now = new Date();
  let filesDeleted = 0;
  let filesKept = 0;
  for (const [staleName, lastUploaded] of existingBlobNames) {
    if (!shouldDeleteOldSpaFile(lastUploaded, now)) {
      filesKept++;
      continue;
    }
    await containerClient.deleteBlob(staleName);
    filesDeleted++;
  }

  return { filesUploaded, filesDeleted, filesKept };
}
