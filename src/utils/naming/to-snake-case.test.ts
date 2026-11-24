import { describe, it, expect } from '@rstest/core';
import { toSnakeCase } from './to-snake-case';

describe('toSnakeCase', () => {
  describe('Standard use cases', () => {
    it('should keep a single word', () => {
      expect(toSnakeCase('auth')).toBe('auth');
    });

    it('should convert a kebab-case name', () => {
      expect(toSnakeCase('auth-service')).toBe('auth_service');
    });

    it('should keep digits in place', () => {
      expect(toSnakeCase('payment-v2-service')).toBe('payment_v2_service');
      expect(toSnakeCase('api-2-service')).toBe('api_2_service');
    });

    it('should convert a domain name with dots turned into hyphens', () => {
      expect(toSnakeCase('www-example-com')).toBe('www_example_com');
    });
  });

  describe('Edge cases', () => {
    it('should handle an empty string', () => {
      expect(toSnakeCase('')).toBe('');
    });

    it('should convert consecutive hyphens', () => {
      expect(toSnakeCase('a--b')).toBe('a__b');
      expect(toSnakeCase('xn--bcher-kva-ch')).toBe('xn__bcher_kva_ch');
    });

    it('should convert a name starting with a digit', () => {
      expect(toSnakeCase('1password-com')).toBe('1password_com');
    });

    it('should keep capitals like the plain conversion', () => {
      expect(toSnakeCase('myApp')).toBe('myApp');
      expect(toSnakeCase('Example-com')).toBe('Example_com');
    });

    it('should keep underscores', () => {
      expect(toSnakeCase('auth_service')).toBe('auth_service');
      expect(toSnakeCase('a_b-c')).toBe('a_b_c');
    });
  });

  describe('Same result as the plain conversion', () => {
    const inputs = [
      'auth-service',
      'uploads',
      'a',
      'a--b',
      'xn--bcher-kva-ch',
      '1password-com',
      '-x',
      'x-',
      'a_b-c',
      'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      'Example-com',
      'myApp',
      'MyApp',
      'USER_ID',
      'www.example.com',
      'a b',
    ];

    it.each(inputs)('should convert %j like the plain conversion', (input) => {
      expect(toSnakeCase(input)).toBe(input.replace(/-/g, '_'));
    });
  });
});
