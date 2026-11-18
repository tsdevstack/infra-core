import { describe, it, expect, rs, beforeEach } from '@rstest/core';
import type { InfraCoreRuntime } from '../../types/runtime.ts';
import type { AWSCredentials } from '../../types/credentials.ts';
import { InfraCoreError } from '../../runtime/infra-core-error.ts';

const mockSend = rs.fn();

rs.mock('@aws-sdk/client-cloudfront', () => ({
  CloudFrontClient: rs.fn().mockImplementation(function () {
    return { send: mockSend };
  }),
  CreateInvalidationCommand: rs.fn().mockImplementation(function (
    input: Record<string, unknown>,
  ) {
    return { input };
  }),
}));

import { CloudFrontClient } from '@aws-sdk/client-cloudfront';
import { invalidateCloudfront } from './invalidate-cloudfront.ts';

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

const CREDENTIALS = {
  accessKeyId: 'key-id',
  secretAccessKey: 'secret',
  region: 'eu-central-1',
} as AWSCredentials;

interface InvalidationInput {
  DistributionId: string;
  InvalidationBatch: {
    CallerReference: string;
    Paths: { Quantity: number; Items: string[] };
  };
}

function sentInput(): InvalidationInput {
  return (mockSend.mock.calls[0][0] as { input: InvalidationInput }).input;
}

describe('invalidateCloudfront', () => {
  beforeEach(() => {
    rs.clearAllMocks();
    rs.mocked(mockRuntime.isCIEnv).mockReturnValue(false);
    mockSend.mockResolvedValue({ Invalidation: { Id: 'I2J0I21PCUYOIK' } });
  });

  describe('Standard use cases', () => {
    it('should clear the whole distribution and return the invalidation ID', async () => {
      const result = await invalidateCloudfront(mockRuntime, {
        distributionId: 'E1ABCDEF',
        credentials: CREDENTIALS,
      });

      const input = sentInput();
      expect(input.DistributionId).toBe('E1ABCDEF');
      expect(input.InvalidationBatch.Paths).toEqual({
        Quantity: 1,
        Items: ['/*'],
      });
      expect(input.InvalidationBatch.CallerReference).toMatch(
        /^spa-deploy-\d+$/,
      );
      expect(result).toEqual({ invalidationId: 'I2J0I21PCUYOIK' });
    });

    it('should call CloudFront in us-east-1 with the explicit credentials locally', async () => {
      await invalidateCloudfront(mockRuntime, {
        distributionId: 'E1ABCDEF',
        credentials: CREDENTIALS,
      });

      expect(CloudFrontClient).toHaveBeenCalledWith({
        region: 'us-east-1',
        credentials: { accessKeyId: 'key-id', secretAccessKey: 'secret' },
      });
    });
  });

  describe('Edge cases', () => {
    it('should clear only the given paths', async () => {
      await invalidateCloudfront(mockRuntime, {
        distributionId: 'E1ABCDEF',
        paths: ['/index.html', '/assets/*'],
        credentials: CREDENTIALS,
      });

      expect(sentInput().InvalidationBatch.Paths).toEqual({
        Quantity: 2,
        Items: ['/index.html', '/assets/*'],
      });
    });

    it("should leave the credentials to the SDK's own chain in CI", async () => {
      rs.mocked(mockRuntime.isCIEnv).mockReturnValue(true);

      await invalidateCloudfront(mockRuntime, {
        distributionId: 'E1ABCDEF',
        credentials: CREDENTIALS,
      });

      expect(CloudFrontClient).toHaveBeenCalledWith({ region: 'us-east-1' });
    });

    it("should fail with CloudFront's message", async () => {
      mockSend.mockRejectedValue(new Error('NoSuchDistribution'));

      const error = await invalidateCloudfront(mockRuntime, {
        distributionId: 'E1ABCDEF',
        credentials: CREDENTIALS,
      }).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(InfraCoreError);
      expect((error as InfraCoreError).message).toBe(
        'Failed to create CloudFront invalidation',
      );
      expect((error as InfraCoreError).hint).toBe('NoSuchDistribution');
    });
  });
});
