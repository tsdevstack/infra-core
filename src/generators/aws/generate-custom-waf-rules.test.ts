import { describe, it, expect } from '@rstest/core';
import { generateAwsCustomWafRules } from './generate-custom-waf-rules';
import type { AwsWafCustomRule } from '../../types/config.ts';

describe('generateAwsCustomWafRules', () => {
  it('should return empty string for empty array', () => {
    expect(generateAwsCustomWafRules([])).toBe('');
  });

  it('should return empty string for undefined-like input', () => {
    expect(
      generateAwsCustomWafRules(undefined as unknown as AwsWafCustomRule[]),
    ).toBe('');
  });

  describe('byte_match rules', () => {
    it('should generate byte_match rule for URI path', () => {
      const rules: AwsWafCustomRule[] = [
        {
          name: 'BlockAdminPath',
          priority: 100,
          action: 'block',
          matchType: 'byte_match',
          byteMatch: {
            searchString: '/admin',
            fieldToMatch: 'uri_path',
            positionalConstraint: 'STARTS_WITH',
          },
        },
      ];

      const result = generateAwsCustomWafRules(rules);
      expect(result).toContain('BlockAdminPath');
      expect(result).toContain('priority = 100');
      expect(result).toContain('byte_match_statement');
      expect(result).toContain('/admin');
      expect(result).toContain('STARTS_WITH');
      expect(result).toContain('uri_path {}');
      expect(result).toContain('block {}');
    });

    it('should generate byte_match rule for header', () => {
      const rules: AwsWafCustomRule[] = [
        {
          name: 'BlockBadUserAgent',
          priority: 101,
          action: 'block',
          matchType: 'byte_match',
          byteMatch: {
            searchString: 'BadBot',
            fieldToMatch: 'header',
            headerName: 'User-Agent',
            positionalConstraint: 'CONTAINS',
          },
        },
      ];

      const result = generateAwsCustomWafRules(rules);
      expect(result).toContain('single_header');
      expect(result).toContain('user-agent');
      expect(result).toContain('BadBot');
      expect(result).toContain('CONTAINS');
    });

    it('should include URL_DECODE text transformation', () => {
      const rules: AwsWafCustomRule[] = [
        {
          name: 'TestRule',
          priority: 100,
          action: 'block',
          matchType: 'byte_match',
          byteMatch: {
            searchString: 'test',
            fieldToMatch: 'uri_path',
            positionalConstraint: 'CONTAINS',
          },
        },
      ];

      const result = generateAwsCustomWafRules(rules);
      expect(result).toContain('text_transformation');
      expect(result).toContain('URL_DECODE');
    });
  });

  describe('rate_based rules', () => {
    it('should generate rate_based rule', () => {
      const rules: AwsWafCustomRule[] = [
        {
          name: 'ApiRateLimit',
          priority: 200,
          action: 'block',
          matchType: 'rate_based',
          rateLimit: 500,
        },
      ];

      const result = generateAwsCustomWafRules(rules);
      expect(result).toContain('ApiRateLimit');
      expect(result).toContain('rate_based_statement');
      expect(result).toContain('limit              = 500');
      expect(result).toContain('aggregate_key_type = "IP"');
    });
  });

  describe('geo_match rules', () => {
    it('should generate geo_match rule with country codes', () => {
      const rules: AwsWafCustomRule[] = [
        {
          name: 'BlockCountries',
          priority: 300,
          action: 'block',
          matchType: 'geo_match',
          geoMatch: { countryCodes: ['CN', 'RU'] },
        },
      ];

      const result = generateAwsCustomWafRules(rules);
      expect(result).toContain('BlockCountries');
      expect(result).toContain('geo_match_statement');
      expect(result).toContain('"CN"');
      expect(result).toContain('"RU"');
    });
  });

  describe('action types', () => {
    it('should support allow action', () => {
      const rules: AwsWafCustomRule[] = [
        {
          name: 'AllowRule',
          priority: 100,
          action: 'allow',
          matchType: 'geo_match',
          geoMatch: { countryCodes: ['US'] },
        },
      ];

      const result = generateAwsCustomWafRules(rules);
      expect(result).toContain('allow {}');
    });

    it('should support count action', () => {
      const rules: AwsWafCustomRule[] = [
        {
          name: 'CountRule',
          priority: 100,
          action: 'count',
          matchType: 'geo_match',
          geoMatch: { countryCodes: ['US'] },
        },
      ];

      const result = generateAwsCustomWafRules(rules);
      expect(result).toContain('count {}');
    });
  });

  it('should include visibility_config for each rule', () => {
    const rules: AwsWafCustomRule[] = [
      {
        name: 'TestVisibility',
        priority: 100,
        action: 'block',
        matchType: 'rate_based',
        rateLimit: 1000,
      },
    ];

    const result = generateAwsCustomWafRules(rules);
    expect(result).toContain('visibility_config');
    expect(result).toContain('sampled_requests_enabled   = true');
    expect(result).toContain('cloudwatch_metrics_enabled = true');
    expect(result).toContain('metric_name                = "TestVisibility"');
  });

  it('should handle multiple rules', () => {
    const rules: AwsWafCustomRule[] = [
      {
        name: 'Rule1',
        priority: 100,
        action: 'block',
        matchType: 'rate_based',
        rateLimit: 500,
      },
      {
        name: 'Rule2',
        priority: 200,
        action: 'block',
        matchType: 'geo_match',
        geoMatch: { countryCodes: ['CN'] },
      },
    ];

    const result = generateAwsCustomWafRules(rules);
    expect(result).toContain('Rule1');
    expect(result).toContain('Rule2');
    expect(result).toContain('rate_based_statement');
    expect(result).toContain('geo_match_statement');
  });
});
