import { describe, it, expect } from '@rstest/core';
import { generateXrayTf } from './generate-xray-tf';

describe('generateXrayTf', () => {
  const result = generateXrayTf();

  describe('Standard use cases', () => {
    it('should turn Transaction Search on', () => {
      expect(result).toContain(
        'resource "aws_xray_trace_segment_destination" "main" {\n  destination = "CloudWatchLogs"',
      );
    });

    it('should let X-Ray write the spans to CloudWatch Logs', () => {
      expect(result).toContain(
        'resource "aws_cloudwatch_log_resource_policy" "xray_transaction_search"',
      );
      expect(result).toContain(
        'Principal = { Service = "xray.amazonaws.com" }',
      );
      expect(result).toContain('Action    = "logs:PutLogEvents"');
      expect(result).toContain(
        '"arn:aws:logs:${var.aws_region}:${var.aws_account_id}:log-group:aws/spans:*"',
      );
      expect(result).toContain(
        '"arn:aws:logs:${var.aws_region}:${var.aws_account_id}:log-group:/aws/application-signals/data:*"',
      );
    });
  });

  describe('Edge cases', () => {
    it('should only accept writes from X-Ray in this account', () => {
      expect(result).toContain(
        'ArnLike      = { "aws:SourceArn" = "arn:aws:xray:${var.aws_region}:${var.aws_account_id}:*" }',
      );
      expect(result).toContain(
        'StringEquals = { "aws:SourceAccount" = var.aws_account_id }',
      );
    });

    it('should set the destination after the policy exists', () => {
      expect(result).toContain(
        'depends_on = [aws_cloudwatch_log_resource_policy.xray_transaction_search]',
      );
    });
  });
});
