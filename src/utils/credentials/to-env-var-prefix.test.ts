import { describe, it, expect } from '@rstest/core';
import { toEnvVarPrefix } from './to-env-var-prefix';

describe('toEnvVarPrefix', () => {
  describe('standard service names', () => {
    it('should strip -service suffix and convert to uppercase', () => {
      expect(toEnvVarPrefix('auth-service')).toBe('AUTH');
    });

    it('should handle multi-word service names', () => {
      expect(toEnvVarPrefix('offers-service')).toBe('OFFERS');
    });

    it('should handle hyphenated names before -service', () => {
      expect(toEnvVarPrefix('user-auth-service')).toBe('USER_AUTH');
    });
  });

  describe('edge cases', () => {
    it('should handle names without -service suffix', () => {
      expect(toEnvVarPrefix('auth')).toBe('AUTH');
    });

    it('should handle names with hyphens but no -service suffix', () => {
      expect(toEnvVarPrefix('user-auth')).toBe('USER_AUTH');
    });

    it('should handle -service in the middle of the name', () => {
      expect(toEnvVarPrefix('my-service-handler')).toBe('MY_SERVICE_HANDLER');
    });

    it('should handle empty string', () => {
      expect(toEnvVarPrefix('')).toBe('');
    });

    it('should handle single word', () => {
      expect(toEnvVarPrefix('api')).toBe('API');
    });

    it('should handle already uppercase names', () => {
      // Note: regex is case-sensitive, so -SERVICE doesn't match -service$
      expect(toEnvVarPrefix('AUTH-SERVICE')).toBe('AUTH_SERVICE');
    });
  });
});
