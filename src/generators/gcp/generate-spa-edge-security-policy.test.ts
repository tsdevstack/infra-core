import { describe, it, expect } from '@rstest/core';
import { generateSpaEdgeSecurityPolicy } from './generate-spa-edge-security-policy';

describe('generateSpaEdgeSecurityPolicy', () => {
  it('should generate CLOUD_ARMOR_EDGE type policy', () => {
    const result = generateSpaEdgeSecurityPolicy();

    expect(result).toContain('type        = "CLOUD_ARMOR_EDGE"');
  });

  it('should include default allow rule', () => {
    const result = generateSpaEdgeSecurityPolicy();

    expect(result).toContain('action   = "allow"');
    expect(result).toContain('priority = "2147483647"');
  });

  it('should use project name variable', () => {
    const result = generateSpaEdgeSecurityPolicy();

    expect(result).toContain('${var.project_name}');
  });

  it('should include descriptive comments', () => {
    const result = generateSpaEdgeSecurityPolicy();

    expect(result).toContain('Edge Security Policy for SPA Backend Buckets');
    expect(result).toContain('LIMITATION');
  });
});
