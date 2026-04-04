import { describe, it, expect } from '@rstest/core';
import { generateMainTf } from './generate-main-tf';
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

describe('generateMainTf', () => {
  it('should generate valid main.tf content', () => {
    const result = generateMainTf(baseConfig);

    expect(result).toContain('terraform {');
    expect(result).toContain('required_version = ">= 1.5"');
    expect(result).toContain('hashicorp/azurerm');
    expect(result).toContain('~> 4.50');
  });

  it('should include azurerm backend configuration', () => {
    const result = generateMainTf(baseConfig);

    expect(result).toContain('backend "azurerm"');
    expect(result).toContain('storage_account_name = "myprojectdevtfstate"');
    expect(result).toContain('container_name       = "tfstate"');
    expect(result).toContain('resource_group_name  = "myproject-dev-rg"');
  });

  it('should reference resource group as data source', () => {
    const result = generateMainTf(baseConfig);

    expect(result).toContain('data "azurerm_resource_group" "main"');
  });

  it('should configure azurerm provider with features', () => {
    const result = generateMainTf(baseConfig);

    expect(result).toContain('provider "azurerm"');
    expect(result).toContain('purge_soft_delete_on_destroy = false');
    expect(result).toContain('subscription_id');
    expect(result).toContain('var.subscription_id');
    expect(result).toContain('resource_provider_registrations = "none"');
  });

  it('should include data source for current client config', () => {
    const result = generateMainTf(baseConfig);

    expect(result).toContain('data "azurerm_client_config" "current"');
  });

  it('should include local tags block', () => {
    const result = generateMainTf(baseConfig);

    expect(result).toContain('locals {');
    expect(result).toContain('ManagedBy   = "tsdevstack"');
  });

  it('should include Key Vault data source', () => {
    const result = generateMainTf(baseConfig);

    expect(result).toContain('data "azurerm_key_vault" "main"');
    expect(result).toContain(
      'name                = "${var.project_name}-${var.environment}-kv"',
    );
    expect(result).toContain(
      'resource_group_name = data.azurerm_resource_group.main.name',
    );
  });
});
