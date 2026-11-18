import { describe, it, expect, rs, beforeEach } from '@rstest/core';
import type { InfraCoreRuntime } from '../../../types/runtime.ts';
import type { AWSCredentials } from '../../../types/credentials.ts';
import { InfraCoreError } from '../../../runtime/infra-core-error.ts';

const mockSend = rs.fn();

rs.mock('@aws-sdk/client-ecr', () => ({
  ECRClient: rs.fn().mockImplementation(function () {
    return { send: mockSend };
  }),
  GetAuthorizationTokenCommand: rs.fn(),
}));

rs.mock('../../shared/docker-login-via-stdin.ts', () => ({
  dockerLoginViaStdin: rs.fn(),
}));

rs.mock('../../shared/docker-login-with-retry.ts', () => ({
  dockerLoginWithRetry: async (fn: () => Promise<void>) => fn(),
}));

import { ECRClient } from '@aws-sdk/client-ecr';
import { configureEcrAuth } from './configure-ecr-auth.ts';
import { dockerLoginViaStdin } from '../../shared/docker-login-via-stdin.ts';

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

const ECR_URL = 'https://123456789012.dkr.ecr.eu-central-1.amazonaws.com';

function token(text: string): {
  authorizationData: { authorizationToken: string }[];
} {
  return {
    authorizationData: [
      { authorizationToken: Buffer.from(text).toString('base64') },
    ],
  };
}

describe('configureEcrAuth', () => {
  beforeEach(() => {
    rs.clearAllMocks();
    rs.mocked(mockRuntime.isCIEnv).mockReturnValue(false);
    rs.mocked(dockerLoginViaStdin).mockResolvedValue(undefined);
  });

  describe('Standard use cases', () => {
    it('should log Docker in to the registry host with the password from the token', async () => {
      mockSend.mockResolvedValue(token('AWS:ecr-password'));

      await configureEcrAuth(mockRuntime, CREDENTIALS, ECR_URL);

      expect(dockerLoginViaStdin).toHaveBeenCalledWith(
        '123456789012.dkr.ecr.eu-central-1.amazonaws.com',
        'AWS',
        'ecr-password',
      );
    });

    it('should use the explicit credentials locally', async () => {
      mockSend.mockResolvedValue(token('AWS:p'));

      await configureEcrAuth(mockRuntime, CREDENTIALS, ECR_URL);

      expect(ECRClient).toHaveBeenCalledWith({
        region: 'eu-central-1',
        credentials: { accessKeyId: 'key-id', secretAccessKey: 'secret' },
      });
    });

    it("should leave the credentials to the SDK's own chain in CI", async () => {
      rs.mocked(mockRuntime.isCIEnv).mockReturnValue(true);
      mockSend.mockResolvedValue(token('AWS:p'));

      await configureEcrAuth(mockRuntime, CREDENTIALS, ECR_URL);

      expect(ECRClient).toHaveBeenCalledWith({ region: 'eu-central-1' });
    });
  });

  describe('Edge cases', () => {
    it('should fail when ECR refuses the token request', async () => {
      mockSend.mockRejectedValue(new Error('AccessDenied'));

      await expect(
        configureEcrAuth(mockRuntime, CREDENTIALS, ECR_URL),
      ).rejects.toThrow('Failed to get ECR authorization token');
      expect(dockerLoginViaStdin).not.toHaveBeenCalled();
    });

    it('should fail when ECR returns no token', async () => {
      mockSend.mockResolvedValue({ authorizationData: [] });

      await expect(
        configureEcrAuth(mockRuntime, CREDENTIALS, ECR_URL),
      ).rejects.toThrow('No authorization token returned from ECR');
    });

    it('should fail on a token without a password', async () => {
      mockSend.mockResolvedValue(token('AWS'));

      await expect(
        configureEcrAuth(mockRuntime, CREDENTIALS, ECR_URL),
      ).rejects.toThrow('Invalid authorization token format from ECR');
    });

    it("should wrap Docker's own login error", async () => {
      mockSend.mockResolvedValue(token('AWS:p'));
      rs.mocked(dockerLoginViaStdin).mockRejectedValue(
        new Error('Cannot connect to the Docker daemon'),
      );

      const error = await configureEcrAuth(
        mockRuntime,
        CREDENTIALS,
        ECR_URL,
      ).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(InfraCoreError);
      expect((error as Error).message).toBe(
        'Failed to authenticate Docker with ECR',
      );
    });
  });
});
