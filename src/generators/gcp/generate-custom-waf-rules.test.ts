import { describe, it, expect } from '@rstest/core';
import { generateCustomWafRules } from './generate-custom-waf-rules';
import type { GcpWafCustomRule } from '../../types/index.ts';

describe('generateCustomWafRules', () => {
  it('should return empty string for empty array', () => {
    expect(generateCustomWafRules([])).toBe('');
  });

  it('should return empty string for undefined', () => {
    expect(
      generateCustomWafRules(undefined as unknown as GcpWafCustomRule[]),
    ).toBe('');
  });

  it('should generate basic deny rule', () => {
    const rules: GcpWafCustomRule[] = [
      {
        name: 'block-bad-bots',
        action: 'deny(403)',
        priority: 100,
        expression: 'request.headers["user-agent"].contains("BadBot")',
        description: 'Block bad bots',
      },
    ];

    const result = generateCustomWafRules(rules);

    expect(result).toContain('# Custom: block-bad-bots');
    expect(result).toContain('action   = "deny(403)"');
    expect(result).toContain('priority = "100"');
    expect(result).toContain('Block bad bots');
  });

  it('should generate rate limit rule', () => {
    const rules: GcpWafCustomRule[] = [
      {
        name: 'api-rate-limit',
        action: 'throttle',
        priority: 200,
        expression: 'request.path.startsWith("/api")',
        rateLimit: {
          count: 100,
          intervalSec: 60,
        },
      },
    ];

    const result = generateCustomWafRules(rules);

    expect(result).toContain('rate_limit_options');
    expect(result).toContain('count        = 100');
    expect(result).toContain('interval_sec = 60');
    expect(result).toContain('enforce_on_key = "IP"');
  });

  it('should escape HCL special characters in expression', () => {
    const rules: GcpWafCustomRule[] = [
      {
        name: 'test-rule',
        action: 'deny(403)',
        priority: 100,
        expression: 'request.headers["test"]',
      },
    ];

    const result = generateCustomWafRules(rules);

    expect(result).toContain('request.headers[\\"test\\"]');
  });

  it('should use name as description when description not provided', () => {
    const rules: GcpWafCustomRule[] = [
      {
        name: 'my-rule-name',
        action: 'deny(403)',
        priority: 100,
        expression: 'true',
      },
    ];

    const result = generateCustomWafRules(rules);

    expect(result).toContain('description = "my-rule-name"');
  });
});
