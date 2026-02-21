/**
 * Build environment variables for frontend (Next.js) services
 */

export function buildFrontendEnvVars(): Record<string, string> {
  return {
    NODE_ENV: 'production',
  };
}
