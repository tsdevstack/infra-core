import { describe, it, expect } from '@rstest/core';
import { generateScheduledJobsTf } from './generate-scheduled-jobs-tf';
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
  baseDomain: '',
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
};

describe('generateScheduledJobsTf', () => {
  it('should return empty string when no scheduled jobs', () => {
    const result = generateScheduledJobsTf(baseConfig);

    expect(result).toBe('');
  });

  it('should generate Container App Job resource when jobs exist', () => {
    const config: AzureInfraConfig = {
      ...baseConfig,
      scheduledJobs: {
        'daily-cleanup': {
          name: 'daily-cleanup',
          schedule: '0 2 * * *',
          targetService: 'auth-service',
          endpoint: '/jobs/cleanup',
        },
      },
    };

    const result = generateScheduledJobsTf(config);

    expect(result).toContain(
      'resource "azurerm_container_app_job" "scheduled_jobs"',
    );
    expect(result).toContain('for_each = var.scheduled_jobs');
    expect(result).toContain('workload_profile_name      = "Consumption"');
  });

  it('should reference resource group as data source', () => {
    const config: AzureInfraConfig = {
      ...baseConfig,
      scheduledJobs: {
        'daily-cleanup': {
          name: 'daily-cleanup',
          schedule: '0 2 * * *',
          targetService: 'auth-service',
          endpoint: '/jobs/cleanup',
        },
      },
    };

    const result = generateScheduledJobsTf(config);

    expect(result).toContain(
      'resource_group_name          = data.azurerm_resource_group.main.name',
    );
    expect(result).not.toContain('= azurerm_resource_group.main.name');
  });

  it('should reference Key Vault as data source', () => {
    const config: AzureInfraConfig = {
      ...baseConfig,
      scheduledJobs: {
        'daily-cleanup': {
          name: 'daily-cleanup',
          schedule: '0 2 * * *',
          targetService: 'auth-service',
          endpoint: '/jobs/cleanup',
        },
      },
    };

    const result = generateScheduledJobsTf(config);

    expect(result).toContain('data.azurerm_key_vault.main.id');
  });

  it('should use local.tags not local.common_tags', () => {
    const config: AzureInfraConfig = {
      ...baseConfig,
      scheduledJobs: {
        'daily-cleanup': {
          name: 'daily-cleanup',
          schedule: '0 2 * * *',
          targetService: 'auth-service',
          endpoint: '/jobs/cleanup',
        },
      },
    };

    const result = generateScheduledJobsTf(config);

    expect(result).toContain('tags = local.tags');
    expect(result).not.toContain('local.common_tags');
  });

  it('should include schedule trigger config', () => {
    const config: AzureInfraConfig = {
      ...baseConfig,
      scheduledJobs: {
        'daily-cleanup': {
          name: 'daily-cleanup',
          schedule: '0 2 * * *',
          targetService: 'auth-service',
          endpoint: '/jobs/cleanup',
        },
      },
    };

    const result = generateScheduledJobsTf(config);

    expect(result).toContain('schedule_trigger_config {');
    expect(result).toContain('cron_expression');
  });

  it('should include curl retry flags for cold start resilience', () => {
    const config: AzureInfraConfig = {
      ...baseConfig,
      scheduledJobs: {
        'daily-cleanup': {
          name: 'daily-cleanup',
          schedule: '0 2 * * *',
          targetService: 'auth-service',
          endpoint: '/jobs/cleanup',
        },
      },
    };

    const result = generateScheduledJobsTf(config);

    expect(result).toContain('--retry 3');
    expect(result).toContain('--retry-delay 15');
    expect(result).toContain('--retry-all-errors');
  });

  it('should pass job secret value directly to container app job', () => {
    const config: AzureInfraConfig = {
      ...baseConfig,
      scheduledJobs: {
        'daily-cleanup': {
          name: 'daily-cleanup',
          schedule: '0 2 * * *',
          targetService: 'auth-service',
          endpoint: '/jobs/cleanup',
        },
      },
    };

    const result = generateScheduledJobsTf(config);

    expect(result).toContain('name  = "job-secret"');
    expect(result).toContain('value = random_password.job_secret.result');
    expect(result).not.toContain('key_vault_secret_id');
    expect(result).not.toContain('identity = "System"');
  });

  it('should auto-generate JOB_SECRET in Key Vault', () => {
    const config: AzureInfraConfig = {
      ...baseConfig,
      scheduledJobs: {
        'daily-cleanup': {
          name: 'daily-cleanup',
          schedule: '0 2 * * *',
          targetService: 'auth-service',
          endpoint: '/jobs/cleanup',
        },
      },
    };

    const result = generateScheduledJobsTf(config);

    expect(result).toContain('resource "random_password" "job_secret"');
    expect(result).toContain(
      'resource "azurerm_key_vault_secret" "job_secret"',
    );
    expect(result).toContain('random_password.job_secret.result');
  });

  it('should not include identity or role assignment (secret passed directly)', () => {
    const config: AzureInfraConfig = {
      ...baseConfig,
      scheduledJobs: {
        'daily-cleanup': {
          name: 'daily-cleanup',
          schedule: '0 2 * * *',
          targetService: 'auth-service',
          endpoint: '/jobs/cleanup',
        },
      },
    };

    const result = generateScheduledJobsTf(config);

    expect(result).not.toContain('identity {');
    expect(result).not.toContain('type = "SystemAssigned"');
    expect(result).not.toContain('azurerm_role_assignment');
  });
});
