import { describe, it, expect, rs, beforeEach } from '@rstest/core';
import type { InfraCoreRuntime } from '../../types/runtime.ts';

const mockUpload = rs.fn();
const mockDeleteBlob = rs.fn();
const mockGetBlockBlobClient = rs.fn(() => ({ upload: mockUpload }));

function createMockListBlobsFlat(
  blobs: { name: string }[],
): () => AsyncIterable<{ name: string }> {
  return () => ({
    [Symbol.asyncIterator]: async function* () {
      for (const blob of blobs) {
        yield blob;
      }
    },
  });
}

let mockListBlobsFlat = createMockListBlobsFlat([]);

const mockGetContainerClient = rs.fn(() => ({
  getBlockBlobClient: mockGetBlockBlobClient,
  listBlobsFlat: () => mockListBlobsFlat(),
  deleteBlob: mockDeleteBlob,
}));

rs.mock('@azure/storage-blob', () => ({
  BlobServiceClient: rs.fn().mockImplementation(function () {
    return { getContainerClient: mockGetContainerClient };
  }),
  StorageSharedKeyCredential: rs.fn().mockImplementation(function () {
    return {};
  }),
}));

const mockListKeys = rs.fn().mockResolvedValue({
  keys: [{ value: 'fake-storage-key' }],
});

rs.mock('@azure/arm-storage', () => ({
  StorageManagementClient: rs.fn().mockImplementation(function () {
    return {
      storageAccounts: { listKeys: mockListKeys },
    };
  }),
}));

rs.mock('../../utils/fs/get-mime-type.ts', () => ({
  getMimeType: rs.fn(() => 'text/html'),
}));

rs.mock('../../utils/fs/get-cache-control.ts', () => ({
  getCacheControl: rs.fn(() => 'public, max-age=86400'),
}));

rs.mock('../../utils/fs/get-all-files.ts', () => ({
  getAllFiles: rs.fn(),
}));

rs.mock('node:fs', () => ({
  default: {
    readFileSync: rs.fn(() => Buffer.from('file-content')),
  },
}));

import { uploadSpaToAzureStorage } from './upload-spa-to-azure-storage.ts';
import { BlobServiceClient } from '@azure/storage-blob';
import { getAllFiles } from '../../utils/fs/get-all-files.ts';
import { getMimeType } from '../../utils/fs/get-mime-type.ts';
import { getCacheControl } from '../../utils/fs/get-cache-control.ts';

const mockCredential = {} as import('@azure/identity').TokenCredential;

const mockRuntime: InfraCoreRuntime = {
  logger: {
    info: rs.fn(),
    success: rs.fn(),
    error: rs.fn(),
    warn: rs.fn(),
    debug: rs.fn(),
    newline: rs.fn(),
    generating: rs.fn(),
    running: rs.fn(),
    creating: rs.fn(),
    building: rs.fn(),
    checking: rs.fn(),
    complete: rs.fn(),
  },
  executeCommand: rs.fn(),
  writeFile: rs.fn(),
  readFile: rs.fn(() => ''),
  ensureDirectory: rs.fn(),
  cleanupFolder: rs.fn(),
  isCIEnv: rs.fn(() => false),
};

describe('uploadSpaToAzureStorage', () => {
  beforeEach(() => {
    rs.clearAllMocks();
    rs.mocked(getAllFiles).mockReturnValue(['index.html', 'main.js']);
    mockListBlobsFlat = createMockListBlobsFlat([]);
    mockUpload.mockResolvedValue(undefined);
    mockDeleteBlob.mockResolvedValue(undefined);
  });

  it('should create BlobServiceClient with storage account key', async () => {
    await uploadSpaToAzureStorage(mockRuntime, {
      storageAccountName: 'myappdev',
      resourceGroupName: 'myapp-dev-rg',
      sourceDir: '/dist',
      subscriptionId: 'sub-123',
      credential: mockCredential,
    });

    expect(BlobServiceClient).toHaveBeenCalledWith(
      'https://myappdev.blob.core.windows.net',
      expect.anything(),
    );
  });

  it('should use $web container', async () => {
    await uploadSpaToAzureStorage(mockRuntime, {
      storageAccountName: 'myappdev',
      resourceGroupName: 'myapp-dev-rg',
      sourceDir: '/dist',
      subscriptionId: 'sub-123',
      credential: mockCredential,
    });

    expect(mockGetContainerClient).toHaveBeenCalledWith('$web');
  });

  it('should upload all local files', async () => {
    rs.mocked(getAllFiles).mockReturnValue(['index.html', 'main.js']);

    await uploadSpaToAzureStorage(mockRuntime, {
      storageAccountName: 'myappdev',
      resourceGroupName: 'myapp-dev-rg',
      sourceDir: '/dist',
      subscriptionId: 'sub-123',
      credential: mockCredential,
    });

    expect(mockGetBlockBlobClient).toHaveBeenCalledWith('index.html');
    expect(mockGetBlockBlobClient).toHaveBeenCalledWith('main.js');
    expect(mockUpload).toHaveBeenCalledTimes(2);
  });

  it('should set content type and cache control on upload', async () => {
    rs.mocked(getAllFiles).mockReturnValue(['index.html']);
    rs.mocked(getMimeType).mockReturnValue('text/html');
    rs.mocked(getCacheControl).mockReturnValue('no-cache, must-revalidate');

    await uploadSpaToAzureStorage(mockRuntime, {
      storageAccountName: 'myappdev',
      resourceGroupName: 'myapp-dev-rg',
      sourceDir: '/dist',
      subscriptionId: 'sub-123',
      credential: mockCredential,
    });

    expect(mockUpload).toHaveBeenCalledWith(
      expect.any(Buffer),
      expect.any(Number),
      {
        blobHTTPHeaders: {
          blobContentType: 'text/html',
          blobCacheControl: 'no-cache, must-revalidate',
        },
      },
    );
  });

  it('should return upload and delete counts', async () => {
    rs.mocked(getAllFiles).mockReturnValue(['index.html', 'main.js']);
    mockListBlobsFlat = createMockListBlobsFlat([{ name: 'stale.js' }]);

    const result = await uploadSpaToAzureStorage(mockRuntime, {
      storageAccountName: 'myappdev',
      resourceGroupName: 'myapp-dev-rg',
      sourceDir: '/dist',
      subscriptionId: 'sub-123',
      credential: mockCredential,
    });

    expect(result).toEqual({ filesUploaded: 2, filesDeleted: 1 });
  });

  it('should delete stale blobs not in local build', async () => {
    rs.mocked(getAllFiles).mockReturnValue(['index.html']);
    mockListBlobsFlat = createMockListBlobsFlat([
      { name: 'index.html' },
      { name: 'old-file.js' },
      { name: 'removed.css' },
    ]);

    const result = await uploadSpaToAzureStorage(mockRuntime, {
      storageAccountName: 'myappdev',
      resourceGroupName: 'myapp-dev-rg',
      sourceDir: '/dist',
      subscriptionId: 'sub-123',
      credential: mockCredential,
    });

    expect(mockDeleteBlob).toHaveBeenCalledWith('old-file.js');
    expect(mockDeleteBlob).toHaveBeenCalledWith('removed.css');
    expect(result.filesDeleted).toBe(2);
  });

  it('should not delete blobs that exist locally', async () => {
    rs.mocked(getAllFiles).mockReturnValue(['index.html', 'main.js']);
    mockListBlobsFlat = createMockListBlobsFlat([
      { name: 'index.html' },
      { name: 'main.js' },
    ]);

    const result = await uploadSpaToAzureStorage(mockRuntime, {
      storageAccountName: 'myappdev',
      resourceGroupName: 'myapp-dev-rg',
      sourceDir: '/dist',
      subscriptionId: 'sub-123',
      credential: mockCredential,
    });

    expect(mockDeleteBlob).not.toHaveBeenCalled();
    expect(result.filesDeleted).toBe(0);
  });

  it('should handle empty source directory', async () => {
    rs.mocked(getAllFiles).mockReturnValue([]);

    const result = await uploadSpaToAzureStorage(mockRuntime, {
      storageAccountName: 'myappdev',
      resourceGroupName: 'myapp-dev-rg',
      sourceDir: '/dist',
      subscriptionId: 'sub-123',
      credential: mockCredential,
    });

    expect(mockUpload).not.toHaveBeenCalled();
    expect(result.filesUploaded).toBe(0);
  });
});
