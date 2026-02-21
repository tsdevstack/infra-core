import { describe, it, expect } from '@rstest/core';
import { parseServiceFilter } from './parse-service-filter';

describe('parseServiceFilter', () => {
  describe('Standard use cases', () => {
    it('should return undefined when no filter provided', () => {
      expect(parseServiceFilter(undefined)).toBeUndefined();
    });

    it('should parse a single service name', () => {
      expect(parseServiceFilter('auth-service')).toEqual(['auth-service']);
    });

    it('should parse comma-separated service names', () => {
      expect(parseServiceFilter('auth-service,bff-service')).toEqual([
        'auth-service',
        'bff-service',
      ]);
    });

    it('should parse three services', () => {
      expect(
        parseServiceFilter('auth-service,bff-service,offers-service'),
      ).toEqual(['auth-service', 'bff-service', 'offers-service']);
    });
  });

  describe('Edge cases', () => {
    it('should trim whitespace around service names', () => {
      expect(parseServiceFilter('auth-service , bff-service')).toEqual([
        'auth-service',
        'bff-service',
      ]);
    });

    it('should return undefined for empty string', () => {
      expect(parseServiceFilter('')).toBeUndefined();
    });

    it('should return undefined for whitespace-only string', () => {
      expect(parseServiceFilter('  ')).toBeUndefined();
    });

    it('should filter out empty entries from trailing comma', () => {
      expect(parseServiceFilter('auth-service,')).toEqual(['auth-service']);
    });

    it('should filter out empty entries from leading comma', () => {
      expect(parseServiceFilter(',auth-service')).toEqual(['auth-service']);
    });
  });
});
