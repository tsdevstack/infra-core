import { describe, it, expect } from '@rstest/core';
import { toServiceEnvVarName } from './to-service-env-var-name';

describe('toServiceEnvVarName', () => {
  it('should convert auth-service to AUTH_SERVICE', () => {
    expect(toServiceEnvVarName('auth-service')).toBe('AUTH_SERVICE');
  });

  it('should convert offers-service to OFFERS_SERVICE', () => {
    expect(toServiceEnvVarName('offers-service')).toBe('OFFERS_SERVICE');
  });

  it('should convert multi-word names', () => {
    expect(toServiceEnvVarName('user-auth-service')).toBe('USER_AUTH_SERVICE');
  });

  it('should handle names without hyphens', () => {
    expect(toServiceEnvVarName('auth')).toBe('AUTH');
  });

  it('should handle empty string', () => {
    expect(toServiceEnvVarName('')).toBe('');
  });
});
