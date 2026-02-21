import { describe, it, expect } from '@rstest/core';
import { generateS3SpaTf } from './generate-s3-spa-tf';

describe('generateS3SpaTf', () => {
  describe('S3 buckets', () => {
    it('should create S3 buckets for SPAs', () => {
      const result = generateS3SpaTf();
      expect(result).toContain('resource "aws_s3_bucket" "spa"');
      expect(result).toContain('for_each = var.spa_services');
    });

    it('should use project name and service name in bucket name', () => {
      const result = generateS3SpaTf();
      expect(result).toContain(
        'bucket = "${var.project_name}-${each.key}-spa-${var.aws_account_id}"',
      );
    });
  });

  describe('public access block', () => {
    it('should block all public access', () => {
      const result = generateS3SpaTf();
      expect(result).toContain(
        'resource "aws_s3_bucket_public_access_block" "spa"',
      );
      expect(result).toContain('block_public_acls       = true');
      expect(result).toContain('block_public_policy     = true');
      expect(result).toContain('ignore_public_acls      = true');
      expect(result).toContain('restrict_public_buckets = true');
    });
  });

  describe('Origin Access Control', () => {
    it('should create OAC for SPAs', () => {
      const result = generateS3SpaTf();
      expect(result).toContain(
        'resource "aws_cloudfront_origin_access_control" "spa"',
      );
    });

    it('should use S3 origin type', () => {
      const result = generateS3SpaTf();
      expect(result).toContain('origin_access_control_origin_type = "s3"');
    });

    it('should use sigv4 signing', () => {
      const result = generateS3SpaTf();
      expect(result).toContain('signing_behavior                  = "always"');
      expect(result).toContain('signing_protocol                  = "sigv4"');
    });
  });

  describe('CloudFront distribution', () => {
    it('should create CloudFront distribution per SPA', () => {
      const result = generateS3SpaTf();
      expect(result).toContain('resource "aws_cloudfront_distribution" "spa"');
      expect(result).toContain('for_each = var.spa_services');
    });

    it('should attach WAF Web ACL', () => {
      const result = generateS3SpaTf();
      expect(result).toContain(
        'web_acl_id          = aws_wafv2_web_acl.main.arn',
      );
    });

    it('should set default root object to index.html', () => {
      const result = generateS3SpaTf();
      expect(result).toContain('default_root_object = "index.html"');
    });

    it('should use domain from spa_services config', () => {
      const result = generateS3SpaTf();
      expect(result).toContain('aliases             = [each.value.domain]');
    });
  });

  describe('SPA routing', () => {
    it('should return index.html for 404 errors', () => {
      const result = generateS3SpaTf();
      expect(result).toContain('error_code         = 404');
      expect(result).toContain('response_code      = 200');
      expect(result).toContain('response_page_path = "/index.html"');
    });

    it('should return index.html for 403 errors', () => {
      const result = generateS3SpaTf();
      expect(result).toContain('error_code         = 403');
    });
  });

  describe('cache behavior', () => {
    it('should use CachingOptimized policy', () => {
      const result = generateS3SpaTf();
      expect(result).toContain('658327ea-f89d-4fab-a63d-7e88639e58f6');
    });

    it('should redirect to HTTPS', () => {
      const result = generateS3SpaTf();
      expect(result).toContain('viewer_protocol_policy = "redirect-to-https"');
    });
  });

  describe('S3 bucket policy', () => {
    it('should create bucket policy per SPA', () => {
      const result = generateS3SpaTf();
      expect(result).toContain('resource "aws_s3_bucket_policy" "spa"');
    });

    it('should allow CloudFront access only', () => {
      const result = generateS3SpaTf();
      expect(result).toContain('Sid    = "AllowCloudFrontAccess"');
      expect(result).toContain('Service = "cloudfront.amazonaws.com"');
    });

    it('should restrict to specific CloudFront distribution', () => {
      const result = generateS3SpaTf();
      expect(result).toContain(
        '"AWS:SourceArn" = aws_cloudfront_distribution.spa[each.key].arn',
      );
    });
  });

  describe('Route 53 records', () => {
    it('should create A records for SPAs', () => {
      const result = generateS3SpaTf();
      expect(result).toContain('resource "aws_route53_record" "spa"');
    });

    it('should alias to CloudFront distribution', () => {
      const result = generateS3SpaTf();
      expect(result).toContain(
        'name                   = aws_cloudfront_distribution.spa[each.key].domain_name',
      );
      expect(result).toContain(
        'zone_id                = aws_cloudfront_distribution.spa[each.key].hosted_zone_id',
      );
    });
  });

  describe('viewer certificate', () => {
    it('should use ACM certificate', () => {
      const result = generateS3SpaTf();
      expect(result).toContain(
        'acm_certificate_arn      = local.cloudfront_certificate_arn',
      );
    });

    it('should use TLS 1.2 minimum', () => {
      const result = generateS3SpaTf();
      expect(result).toContain('minimum_protocol_version = "TLSv1.2_2021"');
    });
  });

  describe('header comment', () => {
    it('should include generation comment', () => {
      const result = generateS3SpaTf();
      expect(result).toContain('Generated by: npx tsdevstack infra:generate');
    });
  });

  describe('snapshot', () => {
    it('should match snapshot', () => {
      const result = generateS3SpaTf();
      expect(result).toMatchSnapshot();
    });
  });
});
