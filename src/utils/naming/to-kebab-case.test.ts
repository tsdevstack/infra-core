import { describe, it, expect } from '@rstest/core';
import { toKebabCase } from './to-kebab-case';

describe('toKebabCase', () => {
  describe('Standard use cases', () => {
    it('should convert a SCREAMING_SNAKE_CASE name', () => {
      expect(toKebabCase('DATABASE_URL')).toBe('database-url');
    });

    it('should convert a single word', () => {
      expect(toKebabCase('DOMAIN')).toBe('domain');
    });

    it('should keep digits in place', () => {
      expect(toKebabCase('STRIPE_KEY_2')).toBe('stripe-key-2');
    });

    it('should convert a snake_case name', () => {
      expect(toKebabCase('redis_password')).toBe('redis-password');
    });
  });

  describe('Edge cases', () => {
    it('should handle an empty string', () => {
      expect(toKebabCase('')).toBe('');
    });

    it('should convert consecutive underscores', () => {
      expect(toKebabCase('NEXT__FOO')).toBe('next--foo');
    });

    it('should convert leading and trailing underscores', () => {
      expect(toKebabCase('_PRIVATE')).toBe('-private');
      expect(toKebabCase('VALUE_')).toBe('value-');
    });

    it('should keep characters other than underscores', () => {
      expect(toKebabCase('A.B')).toBe('a.b');
    });
  });

  describe('Same result as the plain conversion', () => {
    const inputs = [
      'DATABASE_URL',
      'REDIS_PASSWORD',
      'KONG_TRUST_TOKEN',
      'STRIPE_KEY_2',
      'API_KEY',
      'NEXT__FOO',
      '_PRIVATE',
      'VALUE_',
      '1ST_PLACE',
      'MIXED-AND_SEPARATORS',
      'camelCase',
      'already-kebab',
      'A.B',
      'a b',
    ];

    it.each(inputs)('should convert %j like the plain conversion', (input) => {
      expect(toKebabCase(input)).toBe(input.toLowerCase().replace(/_/g, '-'));
    });
  });
});
