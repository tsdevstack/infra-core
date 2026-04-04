import { describe, it, expect } from '@rstest/core';
import { generateBlobStorageTf } from './generate-blob-storage-tf';
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
  noIndex: false,
  frontdoorPremium: false,
  kongAppServiceSku: 'B1',
  nextjsAppServiceSku: 'B1',
  storageBuckets: ['uploads', 'media'],
};

describe('generateBlobStorageTf', () => {
  describe('empty buckets', () => {
    it('should return empty string when no buckets configured', () => {
      const config = { ...baseConfig, storageBuckets: [] };
      expect(generateBlobStorageTf(config)).toBe('');
    });
  });

  describe('storage account', () => {
    it('should create storage account resource', () => {
      const result = generateBlobStorageTf(baseConfig);
      expect(result).toContain('resource "azurerm_storage_account" "storage"');
    });

    it('should use alphanumeric-only storage account name', () => {
      const result = generateBlobStorageTf(baseConfig);
      expect(result).toContain('storage_account_name = "myprojectdevstorage"');
    });

    it('should strip hyphens from project name in account name', () => {
      const config = { ...baseConfig, projectName: 'my-project' };
      const result = generateBlobStorageTf(config);
      expect(result).toContain('storage_account_name = "myprojectdevstorage"');
    });

    it('should use Standard tier with LRS replication', () => {
      const result = generateBlobStorageTf(baseConfig);
      expect(result).toContain('account_tier             = "Standard"');
      expect(result).toContain('account_replication_type = "LRS"');
    });

    it('should enforce TLS 1.2', () => {
      const result = generateBlobStorageTf(baseConfig);
      expect(result).toContain('min_tls_version          = "TLS1_2"');
    });
  });

  describe('blob properties', () => {
    it('should set 7-day delete retention policy', () => {
      const result = generateBlobStorageTf(baseConfig);
      expect(result).toContain('delete_retention_policy {');
      expect(result).toContain('days = 7');
    });

    it('should configure CORS with all origins', () => {
      const result = generateBlobStorageTf(baseConfig);
      expect(result).toContain('cors_rule {');
      expect(result).toContain('allowed_origins    = ["*"]');
    });
  });

  describe('storage containers', () => {
    it('should create storage container resource with for_each', () => {
      const result = generateBlobStorageTf(baseConfig);
      expect(result).toContain(
        'resource "azurerm_storage_container" "storage"',
      );
      expect(result).toContain('for_each = local.storage_containers');
    });

    it('should build correct container names in locals', () => {
      const result = generateBlobStorageTf(baseConfig);
      expect(result).toContain('"uploads" = "myproject-uploads-dev"');
      expect(result).toContain('"media" = "myproject-media-dev"');
    });

    it('should set private access type', () => {
      const result = generateBlobStorageTf(baseConfig);
      expect(result).toContain('container_access_type = "private"');
    });
  });

  describe('IAM', () => {
    it('should assign Storage Blob Data Contributor role', () => {
      const result = generateBlobStorageTf(baseConfig);
      expect(result).toContain(
        'resource "azurerm_role_assignment" "storage_blob_contributor"',
      );
      expect(result).toContain(
        'role_definition_name             = "Storage Blob Data Contributor"',
      );
    });

    it('should assign role to container apps managed identity', () => {
      const result = generateBlobStorageTf(baseConfig);
      expect(result).toContain(
        'principal_id                     = azurerm_user_assigned_identity.container_apps.principal_id',
      );
    });
  });

  describe('output', () => {
    it('should output storage_buckets map', () => {
      const result = generateBlobStorageTf(baseConfig);
      expect(result).toContain('output "storage_buckets"');
    });

    it('should include name field in output', () => {
      const result = generateBlobStorageTf(baseConfig);
      expect(result).toContain('name                 = container.name');
    });

    it('should include storage_account_name in output', () => {
      const result = generateBlobStorageTf(baseConfig);
      expect(result).toContain(
        'storage_account_name = azurerm_storage_account.storage.name',
      );
    });
  });

  describe('header comment', () => {
    it('should include generation comment', () => {
      const result = generateBlobStorageTf(baseConfig);
      expect(result).toContain('Generated by: npx tsdevstack infra:generate');
    });
  });
});
