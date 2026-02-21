/**
 * Generate custom AWS WAF rules from infrastructure.json config
 *
 * Converts AwsWafCustomRule[] into Terraform HCL rule blocks
 * that are inserted into the WAF Web ACL alongside managed rules.
 *
 * Supports three rule types:
 * - byte_match: String matching on URI path, query string, body, or headers
 * - rate_based: Rate limiting per IP address
 * - geo_match: Geographic country-based blocking/allowing
 */

import type { AwsWafCustomRule } from '../../types/config.ts';

/**
 * Generate AWS WAF custom rule HCL blocks
 */
export function generateAwsCustomWafRules(
  customRules: AwsWafCustomRule[],
): string {
  if (!customRules || customRules.length === 0) {
    return '';
  }

  return customRules
    .map((rule) => {
      const actionBlock =
        rule.action === 'count'
          ? `    action {
      count {}
    }`
          : `    action {
      ${rule.action} {}
    }`;

      const description = rule.description || rule.name;

      if (rule.matchType === 'byte_match' && rule.byteMatch) {
        const fieldToMatch = buildFieldToMatch(rule.byteMatch);
        return `
  # Custom: ${rule.name}
  rule {
    name     = "${rule.name}"
    priority = ${rule.priority}

${actionBlock}

    statement {
      byte_match_statement {
        positional_constraint = "${rule.byteMatch.positionalConstraint}"
        search_string         = "${rule.byteMatch.searchString}"
${fieldToMatch}
        text_transformation {
          priority = 0
          type     = "URL_DECODE"
        }
      }
    }

    visibility_config {
      sampled_requests_enabled   = true
      cloudwatch_metrics_enabled = true
      metric_name                = "${rule.name}"
    }
  }`;
      }

      if (rule.matchType === 'rate_based' && rule.rateLimit) {
        return `
  # Custom: ${rule.name}
  rule {
    name     = "${rule.name}"
    priority = ${rule.priority}

${actionBlock}

    statement {
      rate_based_statement {
        limit              = ${rule.rateLimit}
        aggregate_key_type = "IP"
      }
    }

    visibility_config {
      sampled_requests_enabled   = true
      cloudwatch_metrics_enabled = true
      metric_name                = "${rule.name}"
    }
  }`;
      }

      if (rule.matchType === 'geo_match' && rule.geoMatch) {
        const countryCodes = rule.geoMatch.countryCodes
          .map((c) => `"${c}"`)
          .join(', ');
        return `
  # Custom: ${rule.name} - ${description}
  rule {
    name     = "${rule.name}"
    priority = ${rule.priority}

${actionBlock}

    statement {
      geo_match_statement {
        country_codes = [${countryCodes}]
      }
    }

    visibility_config {
      sampled_requests_enabled   = true
      cloudwatch_metrics_enabled = true
      metric_name                = "${rule.name}"
    }
  }`;
      }

      // Unknown match type — skip
      return '';
    })
    .filter((block) => block !== '')
    .join('\n');
}

/**
 * Build the field_to_match block for byte_match rules
 */
function buildFieldToMatch(
  byteMatch: AwsWafCustomRule['byteMatch'] & object,
): string {
  if (byteMatch.fieldToMatch === 'header' && byteMatch.headerName) {
    return `        field_to_match {
          single_header {
            name = "${byteMatch.headerName.toLowerCase()}"
          }
        }`;
  }

  const fieldMap: Record<string, string> = {
    uri_path: 'uri_path {}',
    query_string: 'query_string {}',
    body: 'body {\n            content = "TEXT_PLAIN"\n          }',
  };

  const field = fieldMap[byteMatch.fieldToMatch] || 'uri_path {}';
  return `        field_to_match {
          ${field}
        }`;
}
