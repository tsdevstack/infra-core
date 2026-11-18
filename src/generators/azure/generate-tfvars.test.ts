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
  naming: 'legacy',
  keyVaultName: 'myproject-dev-kv',
  serviceKeyVaults: {},
  dbJobsKeyVault: 'test-dev-dbjobs',
  databaseServiceKeyVaults: {},
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
  storageBuckets: [],
  noIndex: false,
  frontdoorPremium: false,
  kongAppServiceSku: 'B1',
  nextjsAppServiceSku: 'B1',
  kongScaling: { instances: 1, autoscaleMax: null },
  nextjsScaling: { instances: 1, autoscaleMax: null },
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

  it('should give a job without method or httpTimeout POST and 240 s (the ingress limit)', () => {
    const result = generateTfvars({
      ...baseConfig,
      scheduledJobs: {
        'cleanup-tokens': {
          name: 'cleanup-tokens',
          schedule: '0 */4 * * *',
          targetService: 'auth-service',
          endpoint: '/auth/jobs/cleanup-tokens',
        },
      },
    });

    expect(result).toContain('method       = "POST"');
    expect(result).toContain('timeout      = 240');
  });

  it("should pass the job's own method and httpTimeout", () => {
    const result = generateTfvars({
      ...baseConfig,
      scheduledJobs: {
        'sync-prices': {
          name: 'sync-prices',
          schedule: '0 * * * *',
          targetService: 'offers-service',
          endpoint: '/jobs/sync-prices',
          method: 'PUT',
          httpTimeout: 120,
        },
      },
    });

    expect(result).toContain('method       = "PUT"');
    expect(result).toContain('timeout      = 120');
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
  describe('Key Vaults', () => {
    it('should set the shared vault name', () => {
      expect(generateTfvars(baseConfig)).toContain(
        'key_vault_name     = "myproject-dev-kv"',
      );
    });

    it('should map each service to its own vault', () => {
      const result = generateTfvars({
        ...baseConfig,
        serviceKeyVaults: {
          'auth-service': 'myproject-dev-auth-1a2b3c4d',
          'bff-service': 'myproject-dev-bff-service',
        },
      });

      expect(result).toContain(
        'service_key_vaults = {\n  "auth-service" = "myproject-dev-auth-1a2b3c4d"\n  "bff-service" = "myproject-dev-bff-service"\n}',
      );
    });

    it('should write an empty map without services', () => {
      expect(generateTfvars(baseConfig)).toContain('service_key_vaults = {}');
    });

    it("should set the database jobs' vault and the database services' vaults", () => {
      const result = generateTfvars({
        ...baseConfig,
        dbJobsKeyVault: 'myproject-dev-dbjobs',
        databaseServiceKeyVaults: {
          'auth-service': 'myproject-dev-auth-1a2b3c4d',
        },
      });

      expect(result).toContain(
        'db_jobs_key_vault           = "myproject-dev-dbjobs"',
      );
      expect(result).toContain(
        'database_service_key_vaults = {\n  "auth-service" = "myproject-dev-auth-1a2b3c4d"\n}',
      );
    });
  });
});
