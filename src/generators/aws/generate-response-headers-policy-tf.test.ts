import { describe, it, expect } from '@rstest/core';
import { generateResponseHeadersPolicyTf } from './generate-response-headers-policy-tf';

describe('generateResponseHeadersPolicyTf', () => {
  it('should return a string', () => {
    const result = generateResponseHeadersPolicyTf({});
    expect(typeof result).toBe('string');
  });

  it('should include HSTS header', () => {
    const result = generateResponseHeadersPolicyTf({});
    expect(result).toContain('strict_transport_security');
    expect(result).toContain('63072000');
    expect(result).toContain('include_subdomains');
    expect(result).toContain('preload');
  });

  it('should include X-Content-Type-Options', () => {
    const result = generateResponseHeadersPolicyTf({});
    expect(result).toContain('content_type_options');
  });

  it('should include X-Frame-Options DENY', () => {
    const result = generateResponseHeadersPolicyTf({});
    expect(result).toContain('frame_options');
    expect(result).toContain('DENY');
  });

  it('should include Referrer-Policy', () => {
    const result = generateResponseHeadersPolicyTf({});
    expect(result).toContain('referrer_policy');
    expect(result).toContain('strict-origin-when-cross-origin');
  });

  it('should not include custom_headers_config when noIndex is false', () => {
    const result = generateResponseHeadersPolicyTf({ noIndex: false });
    expect(result).not.toContain('custom_headers_config');
    expect(result).not.toContain('noindex, nofollow');
  });

  it('should not include custom_headers_config when noIndex is undefined', () => {
    const result = generateResponseHeadersPolicyTf({});
    expect(result).not.toContain('custom_headers_config');
  });

  it('should include X-Robots-Tag when noIndex is true', () => {
    const result = generateResponseHeadersPolicyTf({ noIndex: true });
    expect(result).toContain('X-Robots-Tag');
    expect(result).toContain('noindex, nofollow');
    expect(result).toContain('custom_headers_config');
  });

  it('should use project_name and environment in resource name', () => {
    const result = generateResponseHeadersPolicyTf({});
    expect(result).toContain('${var.project_name}-${var.environment}');
  });

  it('should create a named resource that can be referenced', () => {
    const result = generateResponseHeadersPolicyTf({});
    expect(result).toContain(
      'resource "aws_cloudfront_response_headers_policy" "security_headers"',
    );
  });
});
