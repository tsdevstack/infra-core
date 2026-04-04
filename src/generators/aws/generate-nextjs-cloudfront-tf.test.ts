import { describe, it, expect } from '@rstest/core';
import { generateNextjsCloudfrontTf } from './generate-nextjs-cloudfront-tf';

describe('generateNextjsCloudfrontTf', () => {
  describe('cache policies', () => {
    it('should create dynamic cache policy', () => {
      const result = generateNextjsCloudfrontTf();
      expect(result).toContain(
        'resource "aws_cloudfront_cache_policy" "nextjs_dynamic"',
      );
    });

    it('should set default_ttl to 0 for dynamic content', () => {
      const result = generateNextjsCloudfrontTf();
      expect(result).toContain('default_ttl = 0');
    });

    it('should create image cache policy', () => {
      const result = generateNextjsCloudfrontTf();
      expect(result).toContain(
        'resource "aws_cloudfront_cache_policy" "nextjs_images"',
      );
    });

    it('should set 1 day default_ttl for images', () => {
      const result = generateNextjsCloudfrontTf();
      expect(result).toContain('default_ttl = 86400');
    });

    it('should whitelist Authorization header', () => {
      const result = generateNextjsCloudfrontTf();
      expect(result).toContain('items = ["Authorization"]');
    });
  });

  describe('origin request policy', () => {
    it('should create origin request policy', () => {
      const result = generateNextjsCloudfrontTf();
      expect(result).toContain(
        'resource "aws_cloudfront_origin_request_policy" "nextjs_forward_cookies"',
      );
    });

    it('should forward all cookies', () => {
      const result = generateNextjsCloudfrontTf();
      expect(result).toContain('cookie_behavior = "all"');
    });

    it('should forward CORS headers', () => {
      const result = generateNextjsCloudfrontTf();
      expect(result).toContain(
        'items = ["Host", "Origin", "Access-Control-Request-Method", "Access-Control-Request-Headers"]',
      );
    });
  });

  describe('CloudFront distribution', () => {
    it('should create distribution per Next.js service', () => {
      const result = generateNextjsCloudfrontTf();
      expect(result).toContain(
        'resource "aws_cloudfront_distribution" "nextjs"',
      );
      expect(result).toContain('for_each = var.nextjs_services');
    });

    it('should attach WAF Web ACL', () => {
      const result = generateNextjsCloudfrontTf();
      expect(result).toContain('web_acl_id      = aws_wafv2_web_acl.main.arn');
    });

    it('should use ALB as origin', () => {
      const result = generateNextjsCloudfrontTf();
      expect(result).toContain('origin_id   = "alb"');
      expect(result).toContain('domain_name = aws_lb.main.dns_name');
    });

    it('should forward Host header via origin request policy for ALB routing', () => {
      const result = generateNextjsCloudfrontTf();
      expect(result).toContain('items = ["Host", "Origin"');
    });

    it('should use HTTPS only for origin', () => {
      const result = generateNextjsCloudfrontTf();
      expect(result).toContain('origin_protocol_policy = "https-only"');
    });
  });

  describe('cache behaviors', () => {
    it('should have default behavior for dynamic content', () => {
      const result = generateNextjsCloudfrontTf();
      expect(result).toContain('default_cache_behavior {');
      expect(result).toContain('target_origin_id       = "alb"');
    });

    it('should allow all HTTP methods', () => {
      const result = generateNextjsCloudfrontTf();
      expect(result).toContain(
        'allowed_methods = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]',
      );
    });

    it('should have static assets behavior', () => {
      const result = generateNextjsCloudfrontTf();
      expect(result).toContain('path_pattern           = "/_next/static/*"');
    });

    it('should have image optimization behavior', () => {
      const result = generateNextjsCloudfrontTf();
      expect(result).toContain('path_pattern           = "/_next/image/*"');
    });

    it('should have data fetching behavior', () => {
      const result = generateNextjsCloudfrontTf();
      expect(result).toContain('path_pattern           = "/_next/data/*"');
    });

    it('should use CachingOptimized for static assets', () => {
      const result = generateNextjsCloudfrontTf();
      expect(result).toContain(
        'cache_policy_id = "658327ea-f89d-4fab-a63d-7e88639e58f6"',
      );
    });
  });

  describe('viewer certificate', () => {
    it('should use ACM certificate when domain set', () => {
      const result = generateNextjsCloudfrontTf();
      expect(result).toContain(
        'acm_certificate_arn            = var.base_domain != "" ? local.cloudfront_certificate_arn : null',
      );
    });

    it('should use default certificate when no domain', () => {
      const result = generateNextjsCloudfrontTf();
      expect(result).toContain(
        'cloudfront_default_certificate = var.base_domain == ""',
      );
    });
  });

  describe('Route 53 records', () => {
    it('should create A records', () => {
      const result = generateNextjsCloudfrontTf();
      expect(result).toContain('resource "aws_route53_record" "nextjs"');
    });

    it('should alias to CloudFront distribution', () => {
      const result = generateNextjsCloudfrontTf();
      expect(result).toContain(
        'name                   = aws_cloudfront_distribution.nextjs[each.key].domain_name',
      );
    });
  });

  describe('outputs', () => {
    it('should output CloudFront domains', () => {
      const result = generateNextjsCloudfrontTf();
      expect(result).toContain('output "nextjs_cloudfront_domains"');
    });

    it('should output distribution IDs for cache invalidation', () => {
      const result = generateNextjsCloudfrontTf();
      expect(result).toContain('output "nextjs_cloudfront_distribution_ids"');
    });
  });

  describe('header comment', () => {
    it('should include generation comment', () => {
      const result = generateNextjsCloudfrontTf();
      expect(result).toContain('Generated by: npx tsdevstack infra:generate');
    });
  });

  describe('snapshot', () => {
    it('should match snapshot', () => {
      const result = generateNextjsCloudfrontTf();
      expect(result).toMatchSnapshot();
    });
  });
});
