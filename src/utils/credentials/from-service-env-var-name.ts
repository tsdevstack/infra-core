/**
 * Convert environment variable name format back to service name
 *
 * AUTH_SERVICE -> auth-service
 * OFFERS_SERVICE -> offers-service
 *
 * Reverse of toServiceEnvVarName
 */
export function fromServiceEnvVarName(envVarName: string): string {
  return envVarName.toLowerCase().replace(/_/g, '-');
}
