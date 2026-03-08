import { describe, it, expect, rs, beforeEach } from '@rstest/core';

rs.mock('./get-acr-refresh-token.ts', () => ({
  getAcrRefreshToken: rs.fn(),
}));

import { buildAcrAuthConfig } from './build-acr-auth-config';
import { getAcrRefreshToken } from './get-acr-refresh-token';
import type { AzureCredentials } from '../../../types/credentials';

describe('buildAcrAuthConfig', () => {
  const baseCredentials: AzureCredentials = {
    clientId: 'client-123',
    clientSecret: 'secret-456',
    tenantId: 'tenant-789',
    subscriptionId: 'sub-abc',
    location: 'eastus',
  };

  beforeEach(() => {
    rs.restoreAllMocks();
  });

  describe('managed identity path', () => {
    it('should return identity-based registry config', async () => {
      const result = await buildAcrAuthConfig({
        acrLoginServer: 'myacr.azurecr.io',
        acrManagedIdentityId: '/subscriptions/sub/mi-id',
        credentials: baseCredentials,
      });

      expect(result.registries).toEqual([
        { server: 'myacr.azurecr.io', identity: '/subscriptions/sub/mi-id' },
      ]);
      expect(result.identity).toEqual({
        type: 'UserAssigned',
        userAssignedIdentities: { '/subscriptions/sub/mi-id': {} },
      });
      expect(result.secrets).toEqual([]);
    });
  });

  describe('password path (local SP)', () => {
    it('should return password-based registry config with clientSecret', async () => {
      const result = await buildAcrAuthConfig({
        acrLoginServer: 'myacr.azurecr.io',
        credentials: baseCredentials,
      });

      expect(result.registries).toEqual([
        {
          server: 'myacr.azurecr.io',
          username: 'client-123',
          passwordSecretRef: 'acr-password',
        },
      ]);
      expect(result.identity).toBeUndefined();
      expect(result.secrets).toEqual([
        { name: 'acr-password', value: 'secret-456' },
      ]);
    });
  });

  describe('OIDC refresh token path (CI)', () => {
    it('should exchange OIDC token for ACR refresh token', async () => {
      rs.mocked(getAcrRefreshToken).mockResolvedValue('oidc-refresh-token');

      const ciCredentials: AzureCredentials = {
        clientId: 'client-123',
        tenantId: 'tenant-789',
        subscriptionId: 'sub-abc',
        location: 'eastus',
        // No clientSecret — CI uses OIDC
      };

      const result = await buildAcrAuthConfig({
        acrLoginServer: 'myacr.azurecr.io',
        credentials: ciCredentials,
      });

      expect(getAcrRefreshToken).toHaveBeenCalledWith('myacr.azurecr.io');
      expect(result.registries).toEqual([
        {
          server: 'myacr.azurecr.io',
          username: '00000000-0000-0000-0000-000000000000',
          passwordSecretRef: 'acr-password',
        },
      ]);
      expect(result.secrets).toEqual([
        { name: 'acr-password', value: 'oidc-refresh-token' },
      ]);
    });
  });

  describe('no ACR configured', () => {
    it('should return empty config', async () => {
      const result = await buildAcrAuthConfig({
        credentials: baseCredentials,
      });

      expect(result.registries).toBeUndefined();
      expect(result.identity).toBeUndefined();
      expect(result.secrets).toEqual([]);
    });
  });
});
