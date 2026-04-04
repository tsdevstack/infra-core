/**
 * Extract CloudFront CNAME conflict targets from Terraform error output
 *
 * Parses errors like:
 *   Error: creating CloudFront Distribution: ... CNAMEAlreadyExists: ...
 *     with aws_cloudfront_distribution.main,
 */

export interface CnameConflictTarget {
  /** Terraform resource address (e.g., "aws_cloudfront_distribution.main") */
  address: string;
}

/**
 * Extract CloudFront CNAME conflict resource addresses from Terraform output
 */
export function extractCnameConflicts(output: string): CnameConflictTarget[] {
  const targets: CnameConflictTarget[] = [];

  const regex = /CNAMEAlreadyExists[^]*?with ([^,\s]+),/g;

  let match: RegExpExecArray | null;
  while ((match = regex.exec(output)) !== null) {
    targets.push({
      address: match[1],
    });
  }

  return targets;
}
