/**
 * Convert a name to kebab-case
 */

import { transformKey } from 'deep-case-crafter';

/**
 * Convert a name to kebab-case: letters become lowercase and underscores
 * become hyphens. Used to turn environment variable names into names that
 * only allow lowercase letters, digits and hyphens.
 *
 * The name is lowercased first, because deep-case-crafter keeps
 * SCREAMING_SNAKE_CASE names unchanged. A name it still returns unchanged
 * (`a__b`, `_private`) gets the plain conversion instead, so every name
 * converts exactly as before.
 *
 * @example
 * toKebabCase('DATABASE_URL') // => 'database-url'
 * toKebabCase('REDIS_PASSWORD') // => 'redis-password'
 */
export function toKebabCase(name: string): string {
  const lower = name.toLowerCase();
  const plain = lower.replace(/_/g, '-');
  const converted = transformKey(lower, { targetCase: 'kebab' });
  return converted === lower ? plain : converted;
}
