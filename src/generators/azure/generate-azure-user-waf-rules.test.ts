import { describe, it, expect } from '@rstest/core';
import { generateAzureUserWafRules } from './generate-azure-user-waf-rules';
import type { AzureWafCustomRule } from '../../types/config';

describe('generateAzureUserWafRules', () => {
  it('should return empty string for no rules', () => {
    expect(generateAzureUserWafRules([])).toBe('');
  });

  it('should generate a MatchRule with match conditions', () => {
    const rules: AzureWafCustomRule[] = [
      {
        name: 'BlockBadBot',
        type: 'MatchRule',
        priority: 1000,
        action: 'Block',
        matchConditions: [
          {
            matchVariable: 'RequestHeader',
            operator: 'Contains',
            matchValues: ['bad-bot'],
            selector: 'User-Agent',
            transforms: ['Lowercase'],
          },
        ],
        description: 'Block known bad bot',
      },
    ];

    const result = generateAzureUserWafRules(rules);
    expect(result).toContain('name     = "BlockBadBot"');
    expect(result).toContain('type     = "MatchRule"');
    expect(result).toContain('priority = 1000');
    expect(result).toContain('action   = "Block"');
    expect(result).toContain('match_variable = "RequestHeader"');
    expect(result).toContain('selector       = "User-Agent"');
    expect(result).toContain('operator       = "Contains"');
    expect(result).toContain('"bad-bot"');
    expect(result).toContain('transforms     = ["Lowercase"]');
  });

  it('should generate a RateLimitRule with rate limit fields', () => {
    const rules: AzureWafCustomRule[] = [
      {
        name: 'RateLimitCustom',
        type: 'RateLimitRule',
        priority: 1001,
        action: 'Block',
        rateLimitDurationInMinutes: 5,
        rateLimitThreshold: 100,
        matchConditions: [
          {
            matchVariable: 'RequestUri',
            operator: 'Contains',
            matchValues: ['/api/expensive'],
          },
        ],
      },
    ];

    const result = generateAzureUserWafRules(rules);
    expect(result).toContain('type     = "RateLimitRule"');
    expect(result).toContain('rate_limit_duration_in_minutes = 5');
    expect(result).toContain('rate_limit_threshold           = 100');
  });

  it('should generate multiple rules', () => {
    const rules: AzureWafCustomRule[] = [
      {
        name: 'Rule1',
        type: 'MatchRule',
        priority: 1000,
        action: 'Block',
        matchConditions: [
          {
            matchVariable: 'RequestUri',
            operator: 'Contains',
            matchValues: ['/blocked'],
          },
        ],
      },
      {
        name: 'Rule2',
        type: 'MatchRule',
        priority: 1001,
        action: 'Allow',
        matchConditions: [
          {
            matchVariable: 'SocketAddr',
            operator: 'IPMatch',
            matchValues: ['10.0.0.0/8'],
          },
        ],
      },
    ];

    const result = generateAzureUserWafRules(rules);
    expect(result).toContain('name     = "Rule1"');
    expect(result).toContain('name     = "Rule2"');
    expect(result).toContain('action   = "Block"');
    expect(result).toContain('action   = "Allow"');
  });

  it('should not include rate limit fields for MatchRule', () => {
    const rules: AzureWafCustomRule[] = [
      {
        name: 'SimpleBlock',
        type: 'MatchRule',
        priority: 1000,
        action: 'Block',
        matchConditions: [
          {
            matchVariable: 'RequestUri',
            operator: 'Contains',
            matchValues: ['/test'],
          },
        ],
      },
    ];

    const result = generateAzureUserWafRules(rules);
    expect(result).not.toContain('rate_limit_duration_in_minutes');
    expect(result).not.toContain('rate_limit_threshold');
  });

  it('should omit transforms when not specified', () => {
    const rules: AzureWafCustomRule[] = [
      {
        name: 'NoTransforms',
        type: 'MatchRule',
        priority: 1000,
        action: 'Block',
        matchConditions: [
          {
            matchVariable: 'SocketAddr',
            operator: 'IPMatch',
            matchValues: ['192.168.0.0/16'],
          },
        ],
      },
    ];

    const result = generateAzureUserWafRules(rules);
    expect(result).not.toContain('transforms');
  });
});
