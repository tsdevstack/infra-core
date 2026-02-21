import { describe, it, expect } from '@rstest/core';
import { buildFrontendEnvVars } from './build-frontend-env-vars';

describe('buildFrontendEnvVars', () => {
  it('should return correct env vars for frontend service', () => {
    const result = buildFrontendEnvVars();

    expect(result).toEqual({
      NODE_ENV: 'production',
    });
  });

  it('should not include backend-specific env vars', () => {
    const result = buildFrontendEnvVars();

    expect(result).not.toHaveProperty('SECRETS_PROVIDER');
    expect(result).not.toHaveProperty('PROJECT_NAME');
    expect(result).not.toHaveProperty('GCP_PROJECT_ID');
    expect(result).not.toHaveProperty('DB_POOL_MAX');
  });
});
