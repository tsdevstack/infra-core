/**
 * Convert service name to environment variable prefix
 */

/**
 * Convert service name to environment variable prefix
 * auth-service -> AUTH
 * offers-service -> OFFERS
 */
export function toEnvVarPrefix(serviceName: string): string {
  return serviceName
    .replace(/-service$/, '')
    .replace(/-/g, '_')
    .toUpperCase();
}
