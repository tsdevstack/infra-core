/**
 * Convert service name to valid Terraform identifier
 */

import { toSnakeCase } from '../naming/to-snake-case.ts';

/**
 * Convert service name to valid Terraform identifier
 * Replaces hyphens with underscores
 */
export function toTerraformId(name: string): string {
  return toSnakeCase(name);
}
