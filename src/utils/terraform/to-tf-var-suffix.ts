/**
 * Convert service name to TF_VAR suffix
 */

import { toSnakeCase } from '../naming/to-snake-case.ts';

/**
 * Convert service name to TF_VAR suffix
 * auth-service -> auth
 * offers-service -> offers
 */
export function toTfVarSuffix(serviceName: string): string {
  return toSnakeCase(serviceName.replace(/-service$/, ''));
}
