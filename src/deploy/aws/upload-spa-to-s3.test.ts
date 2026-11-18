import { describe, it, expect, rs, beforeEach } from '@rstest/core';
import type { InfraCoreRuntime } from '../../types/runtime.ts';
import type { AWSCredentials } from '../../types/credentials.ts';

interface MockCommand {
  type: 'list' | 'put' | 'delete';
  input: Record<string, unknown>;
}

interface MockObject {
  Key: string;
  LastModified?: Date;
}

let mockListPages: {
  Contents: MockObject[];
  NextContinuationToken?: string;
}[] = [];
const mockSend = rs.fn(async (command: MockCommand) => {
  if (command.type === 'list') {
    const token = command.input.ContinuationToken as string | undefined;
    return mockListPages[token ? Number(token) : 0];
  }
  return {};
});

rs.mock('@aws-sdk/client-s3', () => ({
  S3Client: rs.fn().mockImplementation(function () {
    return { send: mockSend };
  }),
  ListObjectsV2Command: rs.fn().mockImplementation(function (
    input: Record<string, unknown>,
  ) {
    return { type: 'list', input };
  }),
  PutObjectCommand: rs.fn().mockImplementation(function (
    input: Record<string, unknown>,
  ) {
    return { type: 'put', input };
  }),
  DeleteObjectsCommand: rs.fn().mockImplementation(function (
    input: Record<string, unknown>,
  ) {
    return { type: 'delete', input };
  }),
}));

rs.mock('../../utils/fs/get-mime-type.ts', () => ({
  getMimeType: rs.fn(() => 'application/javascript'),
}));

rs.mock('../../utils/fs/get-cache-control.ts', () => ({
  getCacheControl: rs.fn(() => 'public, max-age=31536000, immutable'),
}));

rs.mock('../../utils/fs/get-all-files.ts', () => ({
  getAllFiles: rs.fn(),
}));

rs.mock('node:fs', () => ({
  default: {
    readFileSync: rs.fn(() => Buffer.from('file-content')),
  },
}));

import { uploadSpaToS3 } from './upload-spa-to-s3.ts';
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
  bucketName: 'shop-react-app-spa-123456789012',
  sourceDir: '/dist',
  credentials: {
    accessKeyId: 'key-id',
    secretAccessKey: 'secret',
    region: 'eu-central-1',
  } as AWSCredentials,
};

function hoursAgo(hours: number): Date {
  return new Date(Date.now() - hours * HOUR);
}

function sentOfType(type: MockCommand['type']): MockCommand[] {
  return mockSend.mock.calls
    .map(([command]) => command)
    .filter((command) => command.type === type);
}

describe('uploadSpaToS3', () => {
  beforeEach(() => {
    rs.clearAllMocks();
    mockListPages = [{ Contents: [] }];
  });

  describe('Standard use cases', () => {
    it('should upload every file of the build with its type and cache header', async () => {
      rs.mocked(getAllFiles).mockReturnValue(['index.html', 'assets/a.js']);

      const result = await uploadSpaToS3(mockRuntime, OPTIONS);

      const puts = sentOfType('put');
      expect(puts).toHaveLength(2);
      expect(puts[1].input).toEqual({
        Bucket: 'shop-react-app-spa-123456789012',
        Key: 'assets/a.js',
        Body: expect.any(Buffer),
        ContentType: 'application/javascript',
        CacheControl: 'public, max-age=31536000, immutable',
      });
      expect(result.filesUploaded).toBe(2);
    });

    it('should keep a file left out of the build until a day after its last upload', async () => {
      rs.mocked(getAllFiles).mockReturnValue(['index.html']);
      mockListPages = [
        {
          Contents: [
            { Key: 'index.html', LastModified: hoursAgo(1) },
            { Key: 'assets/page-old1.js', LastModified: hoursAgo(1) },
            { Key: 'assets/page-old2.js', LastModified: hoursAgo(48) },
          ],
        },
      ];

      const result = await uploadSpaToS3(mockRuntime, OPTIONS);

      const deletes = sentOfType('delete');
      expect(deletes).toHaveLength(1);
      expect(deletes[0].input).toEqual({
        Bucket: 'shop-react-app-spa-123456789012',
        Delete: { Objects: [{ Key: 'assets/page-old2.js' }] },
      });
      expect(result).toEqual({
        filesUploaded: 1,
        filesDeleted: 1,
        filesKept: 1,
      });
    });
  });

  describe('Edge cases', () => {
    it('should send no delete when every file left out was uploaded within a day', async () => {
      rs.mocked(getAllFiles).mockReturnValue(['index.html']);
      mockListPages = [
        {
          Contents: [{ Key: 'assets/page-old1.js', LastModified: hoursAgo(2) }],
        },
      ];

      const result = await uploadSpaToS3(mockRuntime, OPTIONS);

      expect(sentOfType('delete')).toHaveLength(0);
      expect(result.filesKept).toBe(1);
    });

    it('should read every page of the bucket listing', async () => {
      rs.mocked(getAllFiles).mockReturnValue(['index.html']);
      mockListPages = [
        {
          Contents: [{ Key: 'old-a.js', LastModified: hoursAgo(30) }],
          NextContinuationToken: '1',
        },
        { Contents: [{ Key: 'old-b.js', LastModified: hoursAgo(30) }] },
      ];

      const result = await uploadSpaToS3(mockRuntime, OPTIONS);

      expect(sentOfType('list')).toHaveLength(2);
      expect(sentOfType('delete')[0].input).toEqual({
        Bucket: 'shop-react-app-spa-123456789012',
        Delete: { Objects: [{ Key: 'old-a.js' }, { Key: 'old-b.js' }] },
      });
      expect(result.filesDeleted).toBe(2);
    });
  });
});
