/**
 * Format a record as an HCL map of strings
 */

import { escapeHcl } from './escape-hcl.ts';

/**
 * Format a record as an HCL map literal, one entry per line
 * { "auth-service": "shop-dev-auth-service" } ->
 * {
 *   "auth-service" = "shop-dev-auth-service"
 * }
 *
 * @param record - Keys and string values
 * @returns The HCL map, `{}` when the record is empty
 */
export function toHclStringMap(record: Record<string, string>): string {
  const entries = Object.entries(record);
  if (entries.length === 0) {
    return '{}';
  }
  const lines = entries.map(
    ([key, value]) => `  "${escapeHcl(key)}" = "${escapeHcl(value)}"`,
  );
  return `{\n${lines.join('\n')}\n}`;
}
