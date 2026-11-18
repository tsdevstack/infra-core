import { describe, it, expect, rs, beforeEach } from '@rstest/core';
import type { InfraCoreRuntime } from '../../types/runtime.ts';
import type { GCPCredentials } from '../../types/credentials.ts';

interface MockFile {
  name: string;
  metadata: { updated?: string };
}

const mockUpload = rs.fn();
const mockDelete = rs.fn();
const mockFile = rs.fn(() => ({ delete: mockDelete }));
let mockExistingFiles: MockFile[] = [];
const mockGetFiles = rs.fn(async () => [mockExistingFiles]);
const mockBucket = rs.fn(() => ({
  getFiles: mockGetFiles,
  upload: mockUpload,
  file: mockFile,
}));

rs.mock('@google-cloud/storage', () => ({
  Storage: rs.fn().mockImplementation(function () {
    return { bucket: mockBucket };
  }),
}));

rs.mock('../../utils/gcp/build-gcp-client-options.ts', () => ({
  buildGCPClientOptions: rs.fn(() => ({})),
}));

rs.mock('../../utils/fs/get-mime-type.ts', () => ({
  getMimeType: rs.fn(() => 'text/html'),
}));

rs.mock('../../utils/fs/get-cache-control.ts', () => ({
  getCacheControl: rs.fn(() => 'no-cache, must-revalidate'),
}));

rs.mock('../../utils/fs/get-all-files.ts', () => ({
  getAllFiles: rs.fn(),
}));

import { uploadSpaToCloudStorage } from './upload-spa-to-cloud-storage.ts';
import { getAllFiles } from '../../utils/fs/get-all-files.ts';

const HOUR = 60 * 60 * 1000;

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

const OPTIONS = {
  bucketName: 'shop-react-app-spa-my-project',
  sourceDir: '/dist',
  credentials: {} as GCPCredentials,
};

function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * HOUR).toISOString();
}

describe('uploadSpaToCloudStorage', () => {
  beforeEach(() => {
    rs.clearAllMocks();
    mockExistingFiles = [];
    mockUpload.mockResolvedValue(undefined);
    mockDelete.mockResolvedValue(undefined);
  });

  describe('Standard use cases', () => {
    it('should upload every file of the build with its type and cache header', async () => {
      rs.mocked(getAllFiles).mockReturnValue(['index.html', 'assets/a.js']);

      const result = await uploadSpaToCloudStorage(mockRuntime, OPTIONS);

      expect(mockBucket).toHaveBeenCalledWith('shop-react-app-spa-my-project');
      expect(mockUpload).toHaveBeenCalledWith('/dist/index.html', {
        destination: 'index.html',
        metadata: {
          contentType: 'text/html',
          cacheControl: 'no-cache, must-revalidate',
        },
      });
      expect(mockUpload).toHaveBeenCalledTimes(2);
      expect(result.filesUploaded).toBe(2);
    });

    it('should keep a file left out of the build until a day after its last upload', async () => {
      rs.mocked(getAllFiles).mockReturnValue(['index.html']);
      mockExistingFiles = [
        { name: 'index.html', metadata: { updated: hoursAgo(1) } },
        { name: 'assets/page-old1.js', metadata: { updated: hoursAgo(1) } },
        { name: 'assets/page-old2.js', metadata: { updated: hoursAgo(48) } },
      ];

      const result = await uploadSpaToCloudStorage(mockRuntime, OPTIONS);

      expect(mockFile).toHaveBeenCalledTimes(1);
      expect(mockFile).toHaveBeenCalledWith('assets/page-old2.js');
      expect(mockDelete).toHaveBeenCalledTimes(1);
      expect(result).toEqual({
        filesUploaded: 1,
        filesDeleted: 1,
        filesKept: 1,
      });
    });
  });

  describe('Edge cases', () => {
    it('should delete a file left out of the build without an upload time', async () => {
      rs.mocked(getAllFiles).mockReturnValue(['index.html']);
      mockExistingFiles = [{ name: 'old.js', metadata: {} }];

      const result = await uploadSpaToCloudStorage(mockRuntime, OPTIONS);

      expect(mockFile).toHaveBeenCalledWith('old.js');
      expect(result.filesDeleted).toBe(1);
    });

    it('should never delete a file that is in the build', async () => {
      rs.mocked(getAllFiles).mockReturnValue(['index.html', 'assets/a.js']);
      mockExistingFiles = [
        { name: 'index.html', metadata: { updated: hoursAgo(72) } },
        { name: 'assets/a.js', metadata: { updated: hoursAgo(72) } },
      ];

      const result = await uploadSpaToCloudStorage(mockRuntime, OPTIONS);

      expect(mockDelete).not.toHaveBeenCalled();
      expect(result).toEqual({
        filesUploaded: 2,
        filesDeleted: 0,
        filesKept: 0,
      });
    });
  });
});
