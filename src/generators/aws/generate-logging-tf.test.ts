import { describe, it, expect } from '@rstest/core';
import { generateLoggingTf } from './generate-logging-tf';

describe('generateLoggingTf', () => {
  const result = generateLoggingTf();

  describe('ALB access logs bucket', () => {
    it('should create ALB logs S3 bucket', () => {
      expect(result).toContain('resource "aws_s3_bucket" "alb_logs"');
    });

    it('should include account ID in bucket name for uniqueness', () => {
      expect(result).toContain(
        '${var.project_name}-${var.environment}-alb-logs-${var.aws_account_id}',
      );
    });

    it('should empty the bucket on destroy', () => {
      expect(result).toContain(
        'bucket        = "${var.project_name}-${var.environment}-alb-logs-${var.aws_account_id}"\n  force_destroy = true',
      );
    });

    it('should configure 90 day lifecycle', () => {
      expect(result).toContain(
        'resource "aws_s3_bucket_lifecycle_configuration" "alb_logs"',
      );
      expect(result).toContain('days = 90');
    });

    it('should configure bucket policy for ELB log delivery', () => {
      expect(result).toContain('resource "aws_s3_bucket_policy" "alb_logs"');
      expect(result).toContain(
        'logdelivery.elasticloadbalancing.amazonaws.com',
      );
    });
  });

  describe('CloudFront logs bucket', () => {
    it('should create CloudFront logs S3 bucket', () => {
      expect(result).toContain('resource "aws_s3_bucket" "cloudfront_logs"');
    });

    it('should empty the bucket on destroy', () => {
      expect(result).toContain(
        'bucket        = "${var.project_name}-${var.environment}-cf-logs-${var.aws_account_id}"\n  force_destroy = true',
      );
    });

    it('should enable ACL-based ownership for CloudFront logging', () => {
      expect(result).toContain(
        'resource "aws_s3_bucket_ownership_controls" "cloudfront_logs"',
      );
      expect(result).toContain('object_ownership = "BucketOwnerPreferred"');
    });

    it('should set log-delivery-write ACL', () => {
      expect(result).toContain(
        'resource "aws_s3_bucket_acl" "cloudfront_logs"',
      );
      expect(result).toContain('acl    = "log-delivery-write"');
    });

    it('should configure 90 day lifecycle', () => {
      expect(result).toContain(
        'resource "aws_s3_bucket_lifecycle_configuration" "cloudfront_logs"',
      );
    });
  });

  describe('public access and HTTPS on both log buckets', () => {
    function block(header: string): string {
      const start = result.indexOf(header);
      expect(start).toBeGreaterThan(-1);
      return result.slice(start, result.indexOf('\n}\n', start));
    }

    it.each(['alb_logs', 'cloudfront_logs'])(
      'should block all public access on %s',
      (bucket) => {
        const access = block(
          `resource "aws_s3_bucket_public_access_block" "${bucket}"`,
        );
        expect(access).toContain(`bucket = aws_s3_bucket.${bucket}.id`);
        expect(access).toContain('block_public_acls       = true');
        expect(access).toContain('block_public_policy     = true');
        expect(access).toContain('ignore_public_acls      = true');
        expect(access).toContain('restrict_public_buckets = true');
      },
    );

    it.each(['alb_logs', 'cloudfront_logs'])(
      'should refuse requests without HTTPS on %s, after the access block',
      (bucket) => {
        const policy = block(`resource "aws_s3_bucket_policy" "${bucket}"`);
        expect(policy).toContain(
          `depends_on = [aws_s3_bucket_public_access_block.${bucket}]`,
        );
        expect(policy).toContain('Sid       = "DenyInsecureTransport"');
        expect(policy).toContain(
          `Resource  = [aws_s3_bucket.${bucket}.arn, "\${aws_s3_bucket.${bucket}.arn}/*"]`,
        );
      },
    );

    it('should keep the ELB log delivery statement', () => {
      expect(block('resource "aws_s3_bucket_policy" "alb_logs"')).toContain(
        'Sid    = "AllowELBLogDelivery"',
      );
    });

    it('should block public ACLs only after the log delivery ACL is set', () => {
      expect(
        block('resource "aws_s3_bucket_public_access_block" "cloudfront_logs"'),
      ).toContain('depends_on = [aws_s3_bucket_acl.cloudfront_logs]');
    });
  });

  describe('WAF logging (CloudFront scope)', () => {
    it('should create CloudWatch log group with required prefix', () => {
      expect(result).toContain('resource "aws_cloudwatch_log_group" "waf"');
      expect(result).toContain('name              = "aws-waf-logs-');
    });

    it('should use us-east-1 provider for CloudFront WAF', () => {
      const wafLogGroup = result.slice(
        result.indexOf('resource "aws_cloudwatch_log_group" "waf"'),
        result.indexOf(
          'resource "aws_wafv2_web_acl_logging_configuration" "main"',
        ),
      );
      expect(wafLogGroup).toContain('provider = aws.us_east_1');
    });

    it('should set 90 day retention', () => {
      expect(result).toContain('retention_in_days = 90');
    });

    it('should create WAF logging configuration for main Web ACL', () => {
      expect(result).toContain(
        'resource "aws_wafv2_web_acl_logging_configuration" "main"',
      );
      expect(result).toContain(
        'resource_arn            = aws_wafv2_web_acl.main.arn',
      );
    });

    it('should redact the credential headers', () => {
      const config = result.slice(
        result.indexOf('resource "aws_wafv2_web_acl_logging_configuration"'),
      );
      for (const header of [
        'authorization',
        'cookie',
        'x-tsdevstack-frontend-token',
      ]) {
        expect(config).toContain(
          `  redacted_fields {\n    single_header {\n      name = "${header}"\n    }\n  }`,
        );
      }
    });
  });

  describe('header comment', () => {
    it('should include generation comment', () => {
      expect(result).toContain('Generated by: npx tsdevstack infra:generate');
    });
  });
});
