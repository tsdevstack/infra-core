/**
 * The S3 bucket policy statement that refuses every request not made over
 * HTTPS (`aws:SecureTransport` false), on the bucket and its objects. AWS's
 * own security checks expect it (Security Hub S3.5). A Deny with Principal
 * "*" does not make a policy public, so Block Public Access accepts it.
 *
 * HCL for a `jsonencode` Statement list. `bucketArn` is a Terraform
 * expression (aws_s3_bucket.x.arn); every line is prefixed with `indent`.
 */

export function buildDenyInsecureTransportStatement(
  bucketArn: string,
  indent: string,
): string {
  return [
    '{',
    '  Sid       = "DenyInsecureTransport"',
    '  Effect    = "Deny"',
    '  Principal = "*"',
    '  Action    = "s3:*"',
    `  Resource  = [${bucketArn}, "\${${bucketArn}}/*"]`,
    '  Condition = {',
    '    Bool = {',
    '      "aws:SecureTransport" = "false"',
    '    }',
    '  }',
    '}',
  ]
    .map((line) => indent + line)
    .join('\n');
}
