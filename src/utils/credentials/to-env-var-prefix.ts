/**
 * Convert service name to environment variable prefix
 */

import { toScreamingSnakeCase } from '../naming/to-screaming-snake-case.ts';

/**
 * Convert service name to environment variable prefix
 * auth-service -> AUTH
 * offers-service -> OFFERS
 */
export function toEnvVarPrefix(serviceName: string): string {
  return toScreamingSnakeCase(serviceName.replace(/-service$/, ''));
}
