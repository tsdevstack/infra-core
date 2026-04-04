import { describe, it, expect } from '@rstest/core';
import { extractCnameConflicts } from './extract-cname-conflicts';

describe('extractCnameConflicts', () => {
  it('should extract single CNAME conflict', () => {
    const output = `
│ Error: creating CloudFront Distribution: operation error CloudFront: CreateDistributionWithTags, https response error StatusCode: 409, RequestID: abc123, CNAMEAlreadyExists: One or more of the CNAMEs you provided are already associated with a different resource.
│
│   with aws_cloudfront_distribution.main,
│   on cloudfront.tf line 12, in resource "aws_cloudfront_distribution" "main":
│   12: resource "aws_cloudfront_distribution" "main" {
`;

    const targets = extractCnameConflicts(output);
    expect(targets).toHaveLength(1);
    expect(targets[0].address).toBe('aws_cloudfront_distribution.main');
  });

  it('should extract multiple CNAME conflicts', () => {
    const output = `
│ Error: creating CloudFront Distribution: CNAMEAlreadyExists: One or more of the CNAMEs you provided are already associated with a different resource.
│
│   with aws_cloudfront_distribution.main,
│   on cloudfront.tf line 12
│
│ Error: creating CloudFront Distribution: CNAMEAlreadyExists: One or more of the CNAMEs you provided are already associated with a different resource.
│
│   with aws_cloudfront_distribution.spa["react-app"],
│   on s3-spa.tf line 44
`;

    const targets = extractCnameConflicts(output);
    expect(targets).toHaveLength(2);
    expect(targets[0].address).toBe('aws_cloudfront_distribution.main');
    expect(targets[1].address).toBe(
      'aws_cloudfront_distribution.spa["react-app"]',
    );
  });

  it('should return empty array when no CNAME conflicts', () => {
    const output = `
│ Error: creating ECS Task Definition: invalid CPU/memory combination
│
│   with aws_ecs_task_definition.service["auth-service"],
`;

    const targets = extractCnameConflicts(output);
    expect(targets).toHaveLength(0);
  });

  it('should return empty array for empty output', () => {
    expect(extractCnameConflicts('')).toHaveLength(0);
  });

  it('should handle mixed errors (CNAME + other)', () => {
    const output = `
│ Error: creating CloudFront Distribution: CNAMEAlreadyExists: already associated
│
│   with aws_cloudfront_distribution.main,
│   on cloudfront.tf line 12
│
│ Error: creating ECS Task Definition: invalid configuration
│
│   with aws_ecs_task_definition.service["auth"],
`;

    const targets = extractCnameConflicts(output);
    expect(targets).toHaveLength(1);
    expect(targets[0].address).toBe('aws_cloudfront_distribution.main');
  });
});
