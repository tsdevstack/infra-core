import { describe, it, expect } from '@rstest/core';
import { toScreamingSnakeCase } from './to-screaming-snake-case';

describe('toScreamingSnakeCase', () => {
  describe('Standard use cases', () => {
    it('should convert a single word', () => {
      expect(toScreamingSnakeCase('uploads')).toBe('UPLOADS');
    });

    it('should convert a kebab-case name', () => {
      expect(toScreamingSnakeCase('auth-service')).toBe('AUTH_SERVICE');
    });

    it('should keep digits in place', () => {
      expect(toScreamingSnakeCase('payment-v2-service')).toBe(
        'PAYMENT_V2_SERVICE',
      );
      expect(toScreamingSnakeCase('api-2-service')).toBe('API_2_SERVICE');
    });

    it('should convert a snake_case name', () => {
      expect(toScreamingSnakeCase('redis_password')).toBe('REDIS_PASSWORD');
    });
  });

  describe('Edge cases', () => {
    it('should handle an empty string', () => {
      expect(toScreamingSnakeCase('')).toBe('');
    });

    it('should convert consecutive hyphens', () => {
      expect(toScreamingSnakeCase('a--b')).toBe('A__B');
    });

    it('should convert leading and trailing hyphens', () => {
      expect(toScreamingSnakeCase('-service')).toBe('_SERVICE');
      expect(toScreamingSnakeCase('service-')).toBe('SERVICE_');
    });

    it('should convert a name starting with a digit', () => {
      expect(toScreamingSnakeCase('2-api')).toBe('2_API');
    });

    it('should keep characters other than hyphens', () => {
      expect(toScreamingSnakeCase('api.service')).toBe('API.SERVICE');
    });

    it('should convert names with capitals like the plain conversion', () => {
      expect(toScreamingSnakeCase('myApp')).toBe('MYAPP');
      expect(toScreamingSnakeCase('Auth-Service')).toBe('AUTH_SERVICE');
    });
  });

  describe('Same result as the plain conversion', () => {
    const inputs = [
      'auth-service',
      'payment-v2-service',
      'uploads',
      'a',
      'a--b',
      'xn--bcher-kva-ch',
      '1password-com',
      '-x',
      'x-',
      'a_b-c',
      'a__b',
      'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      'Example-com',
      'myApp',
      'MyApp',
      'USER_ID',
      'redis_password',
      'api.service',
      'a b',
    ];

    it.each(inputs)('should convert %j like the plain conversion', (input) => {
      expect(toScreamingSnakeCase(input)).toBe(
        input.replace(/-/g, '_').toUpperCase(),
      );
    });
  });
});
