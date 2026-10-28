import { describe, it, expect } from '@rstest/core';
import { findSecretScopeOverlaps } from './find-secret-scope-overlaps.ts';

describe('findSecretScopeOverlaps', () => {
  describe('Standard use cases', () => {
    it('should return nothing when no name is a prefix of another', () => {
      expect(
        findSecretScopeOverlaps([
          'auth-service',
          'offers-service',
          'bff-service',
        ]),
      ).toEqual({});
    });

    it('should list the scope a shorter name covers', () => {
      expect(findSecretScopeOverlaps(['auth', 'auth-service'])).toEqual({
        auth: ['auth-service'],
      });
    });

    it('should list every covered scope, sorted', () => {
      expect(
        findSecretScopeOverlaps(['api', 'api-v2', 'api-admin', 'billing']),
      ).toEqual({ api: ['api-admin', 'api-v2'] });
    });
  });

  describe('Edge cases', () => {
    it('should handle nested overlaps', () => {
      expect(
        findSecretScopeOverlaps([
          'auth',
          'auth-service',
          'auth-service-worker',
        ]),
      ).toEqual({
        auth: ['auth-service', 'auth-service-worker'],
        'auth-service': ['auth-service-worker'],
      });
    });

    it('should not treat a name without the hyphen boundary as an overlap', () => {
      expect(findSecretScopeOverlaps(['auth', 'authz'])).toEqual({});
    });

    it('should ignore duplicate names', () => {
      expect(findSecretScopeOverlaps(['auth', 'auth', 'auth-service'])).toEqual(
        { auth: ['auth-service'] },
      );
    });

    it('should return nothing for an empty list', () => {
      expect(findSecretScopeOverlaps([])).toEqual({});
    });
  });
});
