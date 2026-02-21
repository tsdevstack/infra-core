import { describe, it, expect, rs, beforeEach } from '@rstest/core';
import type { InfraCoreRuntime } from '../../types/runtime';
import type { AzureCredentials } from '../../types/credentials';
import { buildTerraformEnv } from './build-terraform-env';

const mockIsCIEnv = rs.fn();

const mockRuntime = {
  isCIEnv: mockIsCIEnv,
} as unknown as InfraCoreRuntime;

const mockCredentials: AzureCredentials = {
  clientId: 'test-client-id',
  clientSecret: 'test-client-secret',
  tenantId: 'test-tenant-id',
  subscriptionId: 'test-sub-id',
  location: 'eastus',
};

describe('buildTerraformEnv', () => {
  beforeEach(() => {
    rs.clearAllMocks();
  });

  describe('Standard use cases', () => {
    it('should include all credentials in local mode', () => {
      mockIsCIEnv.mockReturnValue(false);

      const env = buildTerraformEnv(mockRuntime, mockCredentials);

      expect(env.ARM_SUBSCRIPTION_ID).toBe('test-sub-id');
      expect(env.ARM_TENANT_ID).toBe('test-tenant-id');
      expect(env.ARM_CLIENT_ID).toBe('test-client-id');
      expect(env.ARM_CLIENT_SECRET).toBe('test-client-secret');
    });

    it('should omit client credentials in CI mode', () => {
      mockIsCIEnv.mockReturnValue(true);

      const env = buildTerraformEnv(mockRuntime, mockCredentials);

      expect(env.ARM_SUBSCRIPTION_ID).toBe('test-sub-id');
      expect(env.ARM_TENANT_ID).toBe('test-tenant-id');
      expect(env.ARM_CLIENT_ID).toBeUndefined();
      expect(env.ARM_CLIENT_SECRET).toBeUndefined();
    });
  });
});
