/**
 * Convert a name to SCREAMING_SNAKE_CASE
 */

import { transformKey } from 'deep-case-crafter';

/**
 * Convert a name to SCREAMING_SNAKE_CASE: hyphens become underscores and
 * letters become capitals. Used for environment variable and secret key names.
 *
 * deep-case-crafter converts the name. A name with a capital letter, or one it
 * returns unchanged (`a--b`, `2-api`, `api.service`), gets the plain
 * conversion instead, so every name converts exactly as before.
 *
 * @example
 * toScreamingSnakeCase('auth-service') // => 'AUTH_SERVICE'
 * toScreamingSnakeCase('my-api-v2') // => 'MY_API_V2'
 */
export function toScreamingSnakeCase(name: string): string {
  const plain = name.replace(/-/g, '_').toUpperCase();
  if (/[A-Z]/.test(name)) return plain;
  const converted = transformKey(name, { targetCase: 'constant' });
  return converted === name ? plain : converted;
}
