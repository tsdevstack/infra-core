/**
 * Generate redirect.tf for domain redirects via CloudFront
 *
 * Creates per redirect domain:
 * - ACM certificate (us-east-1 for CloudFront)
 * - Route 53 DNS validation records
 * - CloudFront Function (lightweight JS for 301 redirect)
 * - CloudFront distribution (WAF + response headers + redirect function)
 * - Route 53 A record pointing to CloudFront
 *
 * Assumes the redirect domain's Route 53 hosted zone already exists.
 * The user must create it manually and point NS records from their registrar.
 */

export interface RedirectConfig {
  /** Domains to redirect (e.g., ["createdevstack.com"]) */
  redirectDomains: string[];
  /** Target domain to redirect to (e.g., "createdevstack.app") */
  canonicalDomain: string;
}

/**
 * Generate redirect terraform configuration
 *
 * Returns empty string if no redirect domains configured.
 */
export function generateRedirectTf(config: RedirectConfig): string {
  const { redirectDomains, canonicalDomain } = config;

  if (!redirectDomains || redirectDomains.length === 0) {
    return '';
  }

  const blocks = redirectDomains.map((domain) => {
    // Convert domain to valid Terraform identifier (e.g., "createdevstack.com" → "createdevstack_com")
    const tfId = domain.replace(/[^a-zA-Z0-9]/g, '_');

    return `
# =============================================================================
# Redirect: ${domain} → ${canonicalDomain}
# =============================================================================

# Route 53 hosted zone lookup for ${domain}
data "aws_route53_zone" "redirect_${tfId}" {
  name = "${domain}"
}

# ACM certificate for ${domain} (us-east-1 for CloudFront)
resource "aws_acm_certificate" "redirect_${tfId}" {
  provider = aws.us_east_1

  domain_name               = "${domain}"
  subject_alternative_names = ["*.${domain}"]
  validation_method         = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = { Name = "\${var.project_name}-redirect-${tfId}" }
}

# DNS validation records for ${domain}
resource "aws_route53_record" "redirect_cert_${tfId}" {
  for_each = {
    for dvo in aws_acm_certificate.redirect_${tfId}.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  }

  zone_id = data.aws_route53_zone.redirect_${tfId}.zone_id
  name    = each.value.name
  type    = each.value.type
  records = [each.value.record]
  ttl     = 60

  allow_overwrite = true
}

# Certificate validation for ${domain}
resource "aws_acm_certificate_validation" "redirect_${tfId}" {
  provider = aws.us_east_1

  certificate_arn         = aws_acm_certificate.redirect_${tfId}.arn
  validation_record_fqdns = [for record in aws_route53_record.redirect_cert_${tfId} : record.fqdn]

  timeouts {
    create = "10m"
  }
}

# CloudFront Function for 301 redirect
resource "aws_cloudfront_function" "redirect_${tfId}" {
  name    = "\${var.project_name}-\${var.environment}-redirect-${tfId}"
  runtime = "cloudfront-js-2.0"
  comment = "301 redirect ${domain} to ${canonicalDomain}"
  publish = true
  code    = <<-EOF
    function handler(event) {
      var request = event.request;
      return {
        statusCode: 301,
        statusDescription: 'Moved Permanently',
        headers: {
          'location': { value: 'https://${canonicalDomain}' + request.uri }
        }
      };
    }
  EOF
}

# CloudFront distribution for ${domain} redirect
resource "aws_cloudfront_distribution" "redirect_${tfId}" {
  enabled      = true
  web_acl_id   = aws_wafv2_web_acl.main.arn
  aliases      = ["${domain}", "*.${domain}"]
  price_class  = "PriceClass_100"
  comment      = "\${var.project_name}-\${var.environment}-redirect-${tfId}"

  origin {
    domain_name = "${canonicalDomain}"
    origin_id   = "dummy"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  default_cache_behavior {
    target_origin_id       = "dummy"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]

    cache_policy_id            = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad"  # CachingDisabled
    response_headers_policy_id = aws_cloudfront_response_headers_policy.security_headers.id

    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.redirect_${tfId}.arn
    }
  }

  viewer_certificate {
    acm_certificate_arn      = aws_acm_certificate_validation.redirect_${tfId}.certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  tags = { Name = "\${var.project_name}-redirect-${tfId}" }
}

# Route 53 A record: ${domain} → CloudFront redirect
resource "aws_route53_record" "redirect_${tfId}" {
  zone_id = data.aws_route53_zone.redirect_${tfId}.zone_id
  name    = "${domain}"
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.redirect_${tfId}.domain_name
    zone_id                = aws_cloudfront_distribution.redirect_${tfId}.hosted_zone_id
    evaluate_target_health = false
  }
}

# Route 53 A record: *.${domain} → CloudFront redirect (wildcard)
resource "aws_route53_record" "redirect_wildcard_${tfId}" {
  zone_id = data.aws_route53_zone.redirect_${tfId}.zone_id
  name    = "*.${domain}"
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.redirect_${tfId}.domain_name
    zone_id                = aws_cloudfront_distribution.redirect_${tfId}.hosted_zone_id
    evaluate_target_health = false
  }
}`;
  });

  return `# Domain Redirects via CloudFront
# Generated by: npx tsdevstack infra:generate
#
# Redirects configured domains to the canonical domain using
# CloudFront Functions for lightweight 301 redirects at edge.
${blocks.join('\n')}
`;
}
