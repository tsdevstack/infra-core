/**
 * Convert a name to snake_case
 */

import { transformKey } from 'deep-case-crafter';

/**
 * Convert a name to snake_case: hyphens become underscores. Used for
 * Terraform identifiers and output keys.
 *
 * deep-case-crafter converts the name. A name with a capital letter, or one it
 * returns unchanged (`a--b`, `2-api`, `www.example.com`), gets the plain
 * conversion instead, so every name converts exactly as before.
 *
 * @example
 * toSnakeCase('auth-service') // => 'auth_service'
 * toSnakeCase('payment-v2-service') // => 'payment_v2_service'
 */
export function toSnakeCase(name: string): string {
  const plain = name.replace(/-/g, '_');
  if (/[A-Z]/.test(name)) return plain;
  const converted = transformKey(name, { targetCase: 'snake' });
  return converted === name ? plain : converted;
}
