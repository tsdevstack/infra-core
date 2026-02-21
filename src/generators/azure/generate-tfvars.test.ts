import { describe, it, expect } from '@rstest/core';
import { generateTfvars } from './generate-tfvars';
import type { AzureInfraConfig } from '../../types/config.ts';

const baseConfig: AzureInfraConfig = {
  provider: 'azure',
  projectName: 'myproject',
  environment: 'dev',
  subscriptionId: 'test-sub-id',
  location: 'eastus',
  storageAccountName: 'myprojectdevtfstate',
  database: {
    tier: 'B_Standard_B1ms',
    storageSizeGb: 32,
    deletionProtection: false,
    backup: false,
  },
  redis: { tier: 'Balanced_B0' },
  servicesWithDatabase: [],
  baseDomain: 'example.com',
  services: {},
  workers: {},
  allDeployables: {},
  spas: {},
  frontends: {},
  scheduledJobs: {},
  noIndex: false,
  frontdoorPremium: false,
  kongAppServiceSku: 'B1',
  nextjsAppServiceSku: 'B1',
};

describe('generateTfvars', () => {
  it('should generate core variable values', () => {
    const result = generateTfvars(baseConfig);

    expect(result).toContain('project_name           = "myproject"');
    expect(result).toContain('environment            = "dev"');
    expect(result).toContain('location               = "eastus"');
    expect(result).toContain('subscription_id        = "test-sub-id"');
    expect(result).toContain('base_domain            = "example.com"');
    expect(result).toContain('kong_app_service_sku   = "B1"');
    expect(result).toContain('nextjs_app_service_sku = "B1"');
  });

  it('should include empty scheduled_jobs when none configured', () => {
    const result = generateTfvars(baseConfig);

    expect(result).toContain('scheduled_jobs = {}');
  });

  it('should include scheduled_jobs map when configured', () => {
    const config: AzureInfraConfig = {
      ...baseConfig,
      scheduledJobs: {
        'cleanup-tokens': {
          name: 'cleanup-tokens',
          schedule: '0 */4 * * *',
          targetService: 'auth-service',
          endpoint: '/auth/jobs/cleanup-tokens',
        },
      },
    };

    const result = generateTfvars(config);

    expect(result).toContain('scheduled_jobs = {');
    expect(result).toContain('"cleanup-tokens"');
    expect(result).toContain('schedule     = "0 */4 * * *"');
    expect(result).toContain('service_name = "auth-service"');
    expect(result).toContain('path         = "/auth/jobs/cleanup-tokens"');
  });

  it('should NOT include database password placeholders (managed by random_password)', () => {
    const config = {
      ...baseConfig,
      servicesWithDatabase: [
        { name: 'auth-service', hasDatabase: true },
        { name: 'bff-service', hasDatabase: false },
      ],
    };

    const result = generateTfvars(config);

    expect(result).not.toContain('db_admin_password');
    expect(result).not.toContain('db_auth_service_password');
    expect(result).not.toContain('PLACEHOLDER');
  });
});
