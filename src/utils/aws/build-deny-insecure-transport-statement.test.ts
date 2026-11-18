import { describe, it, expect } from '@rstest/core';
import { buildDenyInsecureTransportStatement } from './build-deny-insecure-transport-statement.ts';

describe('buildDenyInsecureTransportStatement', () => {
  describe('Standard use cases', () => {
    it('should deny every request without HTTPS on the bucket and its objects', () => {
      const statement = buildDenyInsecureTransportStatement(
        'aws_s3_bucket.alb_logs.arn',
        '',
      );

      expect(statement).toContain('Sid       = "DenyInsecureTransport"');
      expect(statement).toContain('Effect    = "Deny"');
      expect(statement).toContain('Principal = "*"');
      expect(statement).toContain('Action    = "s3:*"');
      expect(statement).toContain(
        'Resource  = [aws_s3_bucket.alb_logs.arn, "${aws_s3_bucket.alb_logs.arn}/*"]',
      );
      expect(statement).toContain('"aws:SecureTransport" = "false"');
    });

    it('should work with a for_each bucket', () => {
      expect(
        buildDenyInsecureTransportStatement(
          'aws_s3_bucket.spa[each.key].arn',
          '',
        ),
      ).toContain(
        'Resource  = [aws_s3_bucket.spa[each.key].arn, "${aws_s3_bucket.spa[each.key].arn}/*"]',
      );
    });
  });

  describe('Edge cases', () => {
    it('should indent every line and end without a trailing comma', () => {
      const statement = buildDenyInsecureTransportStatement(
        'aws_s3_bucket.storage[each.key].arn',
        '    ',
      );
      const lines = statement.split('\n');

      expect(lines.every((line) => line.startsWith('    '))).toBe(true);
      expect(lines[0]).toBe('    {');
      expect(lines[lines.length - 1]).toBe('    }');
    });
  });
});
