/**
 * Generate custom WAF rules for Cloud Armor
 *
 * Converts infrastructure.json WAF rule configuration into
 * Terraform HCL for google_compute_security_policy rules.
 */

import type { GcpWafCustomRule } from '../../types/index.ts';
import { escapeHcl } from '../../utils/terraform/escape-hcl.ts';

/**
 * Generate custom WAF rules from infrastructure.json config
 */
export function generateCustomWafRules(
  customRules: GcpWafCustomRule[],
): string {
  if (!customRules || customRules.length === 0) {
    return '';
  }

  return customRules
    .map((rule) => {
      if (rule.rateLimit) {
        return `
  # Custom: ${rule.name}
  rule {
    action   = "${rule.action}"
    priority = "${rule.priority}"
    match {
      expr {
        expression = "${escapeHcl(rule.expression)}"
      }
    }
    rate_limit_options {
      conform_action = "allow"
      exceed_action  = "deny(429)"
      rate_limit_threshold {
        count        = ${rule.rateLimit.count}
        interval_sec = ${rule.rateLimit.intervalSec}
      }
      enforce_on_key = "IP"
    }
    description = "${rule.description || rule.name}"
  }`;
      }

      return `
  # Custom: ${rule.name}
  rule {
    action   = "${rule.action}"
    priority = "${rule.priority}"
    match {
      expr {
        expression = "${escapeHcl(rule.expression)}"
      }
    }
    description = "${rule.description || rule.name}"
  }`;
    })
    .join('\n');
}
