import { describe, it, expect, rs, beforeEach } from '@rstest/core';
import type { InfraCoreRuntime } from '../../types/runtime.ts';

// Mock global fetch
const mockFetch = rs.fn();
global.fetch = mockFetch;

// Mock getAccessToken function
const mockGetAccessToken = rs.fn();

// Mock GoogleAuth as a class
rs.mock('googleapis', () => ({
  google: {
    auth: {
      GoogleAuth: class MockGoogleAuth {
        constructor(public config: Record<string, unknown>) {}
        getAccessToken() {
          return mockGetAccessToken();
        }
      },
    },
  },
}));

import { waitForImage } from './wait-for-image.ts';

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

describe('waitForImage', () => {
  beforeEach(() => {
    rs.clearAllMocks();
    mockGetAccessToken.mockResolvedValue('mock-access-token');
  });

  describe('image exists', () => {
    it('should succeed immediately if image exists', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      await waitForImage(mockRuntime, {
        imageUri: 'us-central1-docker.pkg.dev/project/repo/image:tag',
        credentials: {
          project_id: 'test-project',
          region: 'us-central1',
          client_email: 'test@test.iam.gserviceaccount.com',
        },
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://us-central1-docker.pkg.dev/v2/project/repo/image/manifests/tag',
        expect.objectContaining({
          method: 'HEAD',
          headers: expect.objectContaining({
            Authorization: 'Bearer mock-access-token',
          }),
        }),
      );
    });
  });

  describe('retry logic', () => {
    it('should retry if image not found initially', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: false })
        .mockResolvedValueOnce({ ok: false })
        .mockResolvedValueOnce({ ok: true });

      await waitForImage(mockRuntime, {
        imageUri: 'us-central1-docker.pkg.dev/project/repo/image:tag',
        credentials: {
          project_id: 'test-project',
          region: 'us-central1',
          client_email: 'test@test.iam.gserviceaccount.com',
        },
        delayMs: 10, // Speed up test
      });

      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should throw after max attempts', async () => {
      mockFetch.mockResolvedValue({ ok: false });

      await expect(
        waitForImage(mockRuntime, {
          imageUri: 'us-central1-docker.pkg.dev/project/repo/image:tag',
          credentials: {
            project_id: 'test-project',
            region: 'us-central1',
            client_email: 'test@test.iam.gserviceaccount.com',
          },
          maxAttempts: 3,
          delayMs: 10,
        }),
      ).rejects.toThrow('Image not found after 3 attempts');
    });
  });

  describe('authentication', () => {
    it('should get access token for requests', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      await waitForImage(mockRuntime, {
        imageUri: 'us-central1-docker.pkg.dev/project/repo/image:tag',
        credentials: {
          project_id: 'test-project',
          region: 'us-central1',
          client_email: 'test@test.iam.gserviceaccount.com',
        },
      });

      expect(mockGetAccessToken).toHaveBeenCalled();
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer mock-access-token',
          }),
        }),
      );
    });

    it('should work with explicit credentials', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      await waitForImage(mockRuntime, {
        imageUri: 'us-central1-docker.pkg.dev/project/repo/image:tag',
        credentials: {
          project_id: 'test-project',
          region: 'us-central1',
          client_email: 'test@test.iam.gserviceaccount.com',
          private_key:
            '-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----',
        },
      });

      expect(mockGetAccessToken).toHaveBeenCalled();
      expect(mockFetch).toHaveBeenCalled();
    });
  });

  describe('image URI parsing', () => {
    it('should parse standard image URI', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      await waitForImage(mockRuntime, {
        imageUri:
          'us-central1-docker.pkg.dev/my-project/my-repo/my-image:v1.0.0',
        credentials: {
          project_id: 'test-project',
          region: 'us-central1',
          client_email: 'test@test.iam.gserviceaccount.com',
        },
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://us-central1-docker.pkg.dev/v2/my-project/my-repo/my-image/manifests/v1.0.0',
        expect.any(Object),
      );
    });

    it('should handle image without tag (defaults to latest)', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      await waitForImage(mockRuntime, {
        imageUri: 'us-central1-docker.pkg.dev/my-project/my-repo/my-image',
        credentials: {
          project_id: 'test-project',
          region: 'us-central1',
          client_email: 'test@test.iam.gserviceaccount.com',
        },
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://us-central1-docker.pkg.dev/v2/my-project/my-repo/my-image/manifests/latest',
        expect.any(Object),
      );
    });
  });

  describe('error handling', () => {
    it('should handle fetch errors gracefully', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(
        waitForImage(mockRuntime, {
          imageUri: 'us-central1-docker.pkg.dev/project/repo/image:tag',
          credentials: {
            project_id: 'test-project',
            region: 'us-central1',
            client_email: 'test@test.iam.gserviceaccount.com',
          },
          maxAttempts: 1,
          delayMs: 10,
        }),
      ).rejects.toThrow('Image not found after 1 attempts');
    });

    it('should handle missing access token', async () => {
      mockGetAccessToken.mockResolvedValue(null);

      await expect(
        waitForImage(mockRuntime, {
          imageUri: 'us-central1-docker.pkg.dev/project/repo/image:tag',
          credentials: {
            project_id: 'test-project',
            region: 'us-central1',
            client_email: 'test@test.iam.gserviceaccount.com',
          },
          maxAttempts: 1,
          delayMs: 10,
        }),
      ).rejects.toThrow('Image not found after 1 attempts');
    });
  });
});
