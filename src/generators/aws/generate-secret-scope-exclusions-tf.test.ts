import { describe, it, expect } from '@rstest/core';
import { generateSecretScopeExclusionsTf } from './generate-secret-scope-exclusions-tf';

describe('generateSecretScopeExclusionsTf', () => {
  describe('Standard use cases', () => {
    it("should deny the secrets of a service whose name extends another's", () => {
      const result = generateSecretScopeExclusionsTf([
        'auth',
        'auth-service',
        'offers-service',
      ]);

      expect(result).toContain('"auth" = ["auth-service"]');
      expect(result).toContain(
        'resource "aws_iam_role_policy" "task_secrets_exclusions"',
      );
      expect(result).toContain(
        'resource "aws_iam_role_policy" "nextjs_task_secrets_exclusions"',
      );
      expect(result).toContain('Effect   = "Deny"');
      expect(result).toContain('secret:${var.project_name}-${other}-*"]');
    });

    it('should deny a role the secrets of every service its name covers', () => {
      const result = generateSecretScopeExclusionsTf([
        'billing',
        'billing-api',
        'billing-worker',
      ]);
      expect(result).toContain('"billing" = ["billing-api", "billing-worker"]');
    });

    it('should only attach the Deny to roles that exist', () => {
      const result = generateSecretScopeExclusionsTf(['auth', 'auth-service']);
      expect(result).toContain('if contains(keys(var.services), name)');
      expect(result).toContain('if contains(keys(var.nextjs_services), name)');
    });
  });

  describe('Edge cases', () => {
    it('should return nothing when no name covers another', () => {
      expect(
        generateSecretScopeExclusionsTf([
          'auth-service',
          'offers-service',
          'billing-service',
        ]),
      ).toBe('');
    });

    it('should return nothing without scopes', () => {
      expect(generateSecretScopeExclusionsTf([])).toBe('');
    });
  });
});
