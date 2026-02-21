import { describe, it, expect, rs, beforeEach } from '@rstest/core';

const { mockDefaultAzureCredential, mockClientSecretCredential } = rs.hoisted(
  () => ({
    mockDefaultAzureCredential: rs.fn(),
    mockClientSecretCredential: rs.fn(),
  }),
);

rs.mock('@azure/identity', () => ({
  DefaultAzureCredential: mockDefaultAzureCredential,
  ClientSecretCredential: mockClientSecretCredential,
}));

import { createAzureCredential } from './create-azure-credential';
import type { AzureCredentials } from '../../types/credentials';

const mockRuntime = {
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
  readFile: rs.fn(),
  ensureDirectory: rs.fn(),
  cleanupFolder: rs.fn(),
  isCIEnv: rs.fn(),
};

const mockCredentials: AzureCredentials = {
  clientId: 'test-client-id',
  clientSecret: 'test-client-secret',
  tenantId: 'test-tenant-id',
  subscriptionId: 'test-sub-id',
  location: 'eastus',
};

describe('createAzureCredential', () => {
  beforeEach(() => {
    rs.clearAllMocks();
  });

  describe('CI mode', () => {
    it('should return DefaultAzureCredential in CI', () => {
      mockRuntime.isCIEnv.mockReturnValue(true);

      createAzureCredential(mockRuntime, mockCredentials);

      expect(mockDefaultAzureCredential).toHaveBeenCalledOnce();
      expect(mockClientSecretCredential).not.toHaveBeenCalled();
    });

    it('should not require clientSecret in CI', () => {
      mockRuntime.isCIEnv.mockReturnValue(true);
      const ciCredentials: AzureCredentials = {
        clientId: 'test-client-id',
        tenantId: 'test-tenant-id',
        subscriptionId: 'test-sub-id',
        location: 'eastus',
      };

      createAzureCredential(mockRuntime, ciCredentials);

      expect(mockDefaultAzureCredential).toHaveBeenCalledOnce();
    });
  });

  describe('Local mode', () => {
    it('should return ClientSecretCredential with credentials', () => {
      mockRuntime.isCIEnv.mockReturnValue(false);

      createAzureCredential(mockRuntime, mockCredentials);

      expect(mockClientSecretCredential).toHaveBeenCalledWith(
        'test-tenant-id',
        'test-client-id',
        'test-client-secret',
      );
      expect(mockDefaultAzureCredential).not.toHaveBeenCalled();
    });

    it('should throw if clientSecret is missing in local mode', () => {
      mockRuntime.isCIEnv.mockReturnValue(false);
      const localCredentials: AzureCredentials = {
        clientId: 'test-client-id',
        tenantId: 'test-tenant-id',
        subscriptionId: 'test-sub-id',
        location: 'eastus',
      };

      expect(() =>
        createAzureCredential(mockRuntime, localCredentials),
      ).toThrow('Azure client secret is required for local development');
    });
  });
});
