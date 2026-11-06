/**
 * AWS WAF logging (the edge log on AWS)
 */

/**
 * Request headers whose values the WAF log records as REDACTED. WAF logs
 * every request header otherwise: these carry the user's access token, the
 * session cookies and the frontend's Kong token (KONG_FRONTEND_TOKEN_HEADER
 * in cli-core).
 */
export const AWS_WAF_REDACTED_HEADERS = [
  'authorization',
  'cookie',
  'x-tsdevstack-frontend-token',
] as const;
