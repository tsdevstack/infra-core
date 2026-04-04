/**
 * Generate Azure Front Door WAF user custom rule blocks
 *
 * Converts AzureWafCustomRule[] from infrastructure.json into
 * Terraform HCL custom_rule blocks appended to the WAF policy.
 */

import type { AzureWafCustomRule } from '../../types/config.ts';
import { escapeHcl } from '../../utils/terraform/escape-hcl.ts';

/**
 * Generate user-defined Azure WAF custom rule HCL blocks
 */
export function generateAzureUserWafRules(
  customRules: AzureWafCustomRule[],
): string {
  if (!customRules || customRules.length === 0) {
    return '';
  }

  return customRules
    .map((rule) => {
      const matchConditionsHcl = rule.matchConditions
        .map((mc) => {
          const values = mc.matchValues
            .map((v) => `"${escapeHcl(v)}"`)
            .join(', ');
          const lines = [
            `    match_condition {`,
            `      match_variable = "${mc.matchVariable}"`,
          ];

          if (mc.selector) {
            lines.push(`      selector       = "${mc.selector}"`);
          }

          lines.push(`      operator       = "${mc.operator}"`);
          lines.push(`      match_values   = [${values}]`);

          if (mc.transforms && mc.transforms.length > 0) {
            const transforms = mc.transforms.map((t) => `"${t}"`).join(', ');
            lines.push(`      transforms     = [${transforms}]`);
          }

          lines.push(`    }`);
          return lines.join('\n');
        })
        .join('\n\n');

      const rateLimitFields =
        rule.type === 'RateLimitRule'
          ? `
    rate_limit_duration_in_minutes = ${rule.rateLimitDurationInMinutes}
    rate_limit_threshold           = ${rule.rateLimitThreshold}
`
          : '';

      const comment = rule.description || rule.name;

      return `  # Custom: ${comment}
  custom_rule {
    name     = "${rule.name}"
    type     = "${rule.type}"
    priority = ${rule.priority}
    action   = "${rule.action}"
${rateLimitFields}
${matchConditionsHcl}
  }`;
    })
    .join('\n\n');
}
