import { describe, it, expect, rs, beforeEach } from '@rstest/core';
import type { InfraCoreRuntime } from '../../../types/runtime.ts';
import { InfraCoreError } from '../../../runtime/infra-core-error.ts';

const mockGetToken = rs.fn();

rs.mock('@azure/identity', () => ({
  DefaultAzureCredential: rs.fn().mockImplementation(function () {
    return { getToken: mockGetToken };
  }),
}));

rs.mock('node:child_process', () => ({
  spawnSync: rs.fn(),
}));

rs.mock('../../shared/docker-login-with-retry.ts', () => ({
  dockerLoginWithRetry: async (fn: () => void) => fn(),
}));

import { configureAcrAuth } from './configure-acr-auth.ts';
import { spawnSync } from 'node:child_process';

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

const mockCredentials = {
  subscriptionId: 'sub-123',
  tenantId: 'tenant-456',
  clientId: 'client-789',
  clientSecret: 'secret-abc',
  location: 'eastus',
};

describe('configureAcrAuth', () => {
  beforeEach(() => {
    rs.clearAllMocks();
    rs.mocked(mockRuntime.isCIEnv).mockReturnValue(false);
  });

  describe('CI mode', () => {
    beforeEach(() => {
      rs.mocked(mockRuntime.isCIEnv).mockReturnValue(true);
      mockGetToken.mockResolvedValue({ token: 'aad-test-token' });
    });

    it('should exchange AAD token for ACR refresh token and docker login', async () => {
      rs.stubGlobal(
        'fetch',
        rs.fn().mockResolvedValue({
          ok: true,
          json: () =>
            Promise.resolve({ refresh_token: 'acr-refresh-token-123' }),
        }),
      );

      rs.mocked(spawnSync).mockReturnValue({
        status: 0,
        stdout: 'Login Succeeded',
        stderr: '',
      } as ReturnType<typeof spawnSync>);

      await configureAcrAuth(
        mockRuntime,
        mockCredentials,
        'myprojectdevacr.azurecr.io',
      );

      // Should get AAD token
      expect(mockGetToken).toHaveBeenCalledWith(
        'https://management.azure.com/.default',
      );

      // Should exchange for ACR refresh token
      expect(fetch).toHaveBeenCalledWith(
        'https://myprojectdevacr.azurecr.io/oauth2/exchange',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        }),
      );

      // Should docker login with refresh token
      expect(spawnSync).toHaveBeenCalledWith(
        'docker',
        [
          'login',
          'myprojectdevacr.azurecr.io',
          '--username',
          '00000000-0000-0000-0000-000000000000',
          '--password-stdin',
        ],
        expect.objectContaining({
          input: 'acr-refresh-token-123',
          encoding: 'utf-8',
        }),
      );
    });

    it('should throw InfraCoreError when token exchange fails', async () => {
      rs.stubGlobal(
        'fetch',
        rs.fn().mockResolvedValue({
          ok: false,
          status: 401,
          text: () => Promise.resolve('Unauthorized'),
        }),
      );

      await expect(
        configureAcrAuth(mockRuntime, mockCredentials, 'myacr.azurecr.io'),
      ).rejects.toThrow(InfraCoreError);
    });

    it('should throw InfraCoreError when AAD token fetch fails', async () => {
      mockGetToken.mockRejectedValue(new Error('OIDC not configured'));

      await expect(
        configureAcrAuth(mockRuntime, mockCredentials, 'myacr.azurecr.io'),
      ).rejects.toThrow(InfraCoreError);
    });

    it('should throw InfraCoreError when docker login fails in CI', async () => {
      rs.stubGlobal(
        'fetch',
        rs.fn().mockResolvedValue({
          ok: true,
          json: () =>
            Promise.resolve({ refresh_token: 'acr-refresh-token-123' }),
        }),
      );

      rs.mocked(spawnSync).mockReturnValue({
        status: 1,
        stdout: '',
        stderr: 'connection refused',
      } as ReturnType<typeof spawnSync>);

      await expect(
        configureAcrAuth(mockRuntime, mockCredentials, 'myacr.azurecr.io'),
      ).rejects.toThrow(InfraCoreError);
    });
  });

  describe('local mode', () => {
    it('should use docker login with service principal', async () => {
      rs.mocked(spawnSync).mockReturnValue({
        status: 0,
        stdout: 'Login Succeeded',
        stderr: '',
      } as ReturnType<typeof spawnSync>);

      await configureAcrAuth(mockRuntime, mockCredentials, 'myacr.azurecr.io');

      expect(spawnSync).toHaveBeenCalledWith(
        'docker',
        [
          'login',
          'myacr.azurecr.io',
          '--username',
          'client-789',
          '--password-stdin',
        ],
        expect.objectContaining({
          input: 'secret-abc',
          encoding: 'utf-8',
        }),
      );
    });

    it('should throw InfraCoreError when docker login fails', async () => {
      rs.mocked(spawnSync).mockReturnValue({
        status: 1,
        stdout: '',
        stderr: 'unauthorized',
      } as ReturnType<typeof spawnSync>);

      await expect(
        configureAcrAuth(mockRuntime, mockCredentials, 'myacr.azurecr.io'),
      ).rejects.toThrow(InfraCoreError);
    });
  });
});
