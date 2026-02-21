import { describe, it, expect, rs, beforeEach } from '@rstest/core';
import { InfraCoreError } from '../../../runtime/infra-core-error.ts';

const mockGetToken = rs.fn();

rs.mock('@azure/identity', () => ({
  DefaultAzureCredential: rs.fn().mockImplementation(function () {
    return { getToken: mockGetToken };
  }),
}));

import { getAcrRefreshToken } from './get-acr-refresh-token.ts';

describe('getAcrRefreshToken', () => {
  beforeEach(() => {
    rs.clearAllMocks();
    mockGetToken.mockResolvedValue({ token: 'aad-test-token' });
  });

  it('should exchange AAD token for ACR refresh token', async () => {
    rs.stubGlobal(
      'fetch',
      rs.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ refresh_token: 'acr-refresh-token-123' }),
      }),
    );

    const result = await getAcrRefreshToken('myacr.azurecr.io');

    expect(result).toBe('acr-refresh-token-123');
    expect(mockGetToken).toHaveBeenCalledWith(
      'https://management.azure.com/.default',
    );
    expect(fetch).toHaveBeenCalledWith(
      'https://myacr.azurecr.io/oauth2/exchange',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
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

    await expect(getAcrRefreshToken('myacr.azurecr.io')).rejects.toThrow(
      InfraCoreError,
    );
  });

  it('should throw InfraCoreError when AAD token fetch fails', async () => {
    mockGetToken.mockRejectedValue(new Error('OIDC not configured'));

    await expect(getAcrRefreshToken('myacr.azurecr.io')).rejects.toThrow(
      InfraCoreError,
    );
  });
});
