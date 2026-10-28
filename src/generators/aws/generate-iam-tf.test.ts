import { describe, it, expect } from '@rstest/core';
import { generateIamTf } from './generate-iam-tf';
import { generateIamRolesTf } from './generate-iam-roles-tf';
import { generateSecretScopeExclusionsTf } from './generate-secret-scope-exclusions-tf';

describe('generateIamTf', () => {
  describe('Standard use cases', () => {
    it('should be the roles alone when no service name covers another', () => {
      const result = generateIamTf(['auth-service', 'offers-service']);
      expect(result).toBe(generateIamRolesTf());
      expect(result).not.toContain('secrets-exclusions');
    });

    it('should append the exclusions when service names overlap', () => {
      const scopes = ['auth', 'auth-service', 'offers-service'];
      expect(generateIamTf(scopes)).toBe(
        `${generateIamRolesTf()}${generateSecretScopeExclusionsTf(scopes)}`,
      );
    });
  });

  describe('Edge cases', () => {
    it('should default to no scopes', () => {
      expect(generateIamTf()).toBe(generateIamRolesTf());
    });
  });

  describe('snapshot', () => {
    it('should match snapshot', () => {
      const result = generateIamTf();
      expect(result).toMatchSnapshot();
    });
  });
});
