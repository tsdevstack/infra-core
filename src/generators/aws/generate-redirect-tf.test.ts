import { describe, it, expect } from '@rstest/core';
import { generateRedirectTf } from './generate-redirect-tf';

describe('generateRedirectTf', () => {
  it('should return empty string for empty redirect domains', () => {
    const result = generateRedirectTf({
      redirectDomains: [],
      canonicalDomain: 'example.com',
    });
    expect(result).toBe('');
  });

  it('should return empty string for undefined redirect domains', () => {
    const result = generateRedirectTf({
      redirectDomains: undefined as unknown as string[],
      canonicalDomain: 'example.com',
    });
    expect(result).toBe('');
  });

  describe('single redirect domain', () => {
    const result = generateRedirectTf({
      redirectDomains: ['old.com'],
      canonicalDomain: 'new.com',
    });

    it('should create Route 53 zone lookup', () => {
      expect(result).toContain('data "aws_route53_zone" "redirect_old_com"');
    });

    it('should create ACM certificate in us-east-1', () => {
      expect(result).toContain(
        'resource "aws_acm_certificate" "redirect_old_com"',
      );
      expect(result).toContain('provider = aws.us_east_1');
      expect(result).toContain('domain_name               = "old.com"');
    });

    it('should include wildcard in SAN', () => {
      expect(result).toContain('subject_alternative_names = ["*.old.com"]');
    });

    it('should create DNS validation records', () => {
      expect(result).toContain(
        'resource "aws_route53_record" "redirect_cert_old_com"',
      );
    });

    it('should create certificate validation', () => {
      expect(result).toContain(
        'resource "aws_acm_certificate_validation" "redirect_old_com"',
      );
    });

    it('should create CloudFront Function with 301 redirect', () => {
      expect(result).toContain(
        'resource "aws_cloudfront_function" "redirect_old_com"',
      );
      expect(result).toContain('statusCode: 301');
      expect(result).toContain("'https://new.com'");
      expect(result).toContain('cloudfront-js-2.0');
    });

    it('should create CloudFront distribution', () => {
      expect(result).toContain(
        'resource "aws_cloudfront_distribution" "redirect_old_com"',
      );
      expect(result).toContain('web_acl_id   = aws_wafv2_web_acl.main.arn');
    });

    it('should attach response headers policy', () => {
      expect(result).toContain(
        'response_headers_policy_id = aws_cloudfront_response_headers_policy.security_headers.id',
      );
    });

    it('should include function association', () => {
      expect(result).toContain('function_association');
      expect(result).toContain('event_type   = "viewer-request"');
    });

    it('should create A record for redirect domain', () => {
      expect(result).toContain(
        'resource "aws_route53_record" "redirect_old_com"',
      );
    });

    it('should create wildcard A record', () => {
      expect(result).toContain(
        'resource "aws_route53_record" "redirect_wildcard_old_com"',
      );
      expect(result).toContain('name    = "*.old.com"');
    });

    it('should include aliases for both apex and wildcard', () => {
      expect(result).toContain('aliases      = ["old.com", "*.old.com"]');
    });
  });

  describe('multiple redirect domains', () => {
    const result = generateRedirectTf({
      redirectDomains: ['old.com', 'legacy.dev'],
      canonicalDomain: 'new.com',
    });

    it('should generate resources for each domain', () => {
      expect(result).toContain('redirect_old_com');
      expect(result).toContain('redirect_legacy_dev');
    });

    it('should redirect both to canonical domain', () => {
      // Both functions redirect to new.com
      const functionMatches = result.match(/https:\/\/new\.com/g);
      expect(functionMatches?.length).toBeGreaterThanOrEqual(2);
    });
  });
});
