/**
 * Convert service name to full environment variable name format
 *
 * auth-service -> AUTH_SERVICE
 * offers-service -> OFFERS_SERVICE
 *
 * Used for service URL placeholders like ${AUTH_SERVICE_URL}
 */
export function toServiceEnvVarName(serviceName: string): string {
  return serviceName.toUpperCase().replace(/-/g, '_');
}
