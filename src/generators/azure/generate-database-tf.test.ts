import { describe, it, expect } from '@rstest/core';
import { generateDatabaseTf } from './generate-database-tf';
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
  servicesWithDatabase: [
    { name: 'auth-service', hasDatabase: true },
    { name: 'bff-service', hasDatabase: false },
    { name: 'offers-service', hasDatabase: true },
  ],
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

describe('generateDatabaseTf', () => {
  describe('PostgreSQL Flexible Server', () => {
    it('should create Flexible Server resource', () => {
      const result = generateDatabaseTf(baseConfig);
      expect(result).toContain(
        'resource "azurerm_postgresql_flexible_server" "main"',
      );
    });

    it('should use PostgreSQL version 16', () => {
      const result = generateDatabaseTf(baseConfig);
      expect(result).toContain('version                       = "16"');
    });

    it('should use postgres subnet', () => {
      const result = generateDatabaseTf(baseConfig);
      expect(result).toContain(
        'delegated_subnet_id           = azurerm_subnet.postgres.id',
      );
    });

    it('should use postgres private DNS zone', () => {
      const result = generateDatabaseTf(baseConfig);
      expect(result).toContain(
        'private_dns_zone_id           = azurerm_private_dns_zone.postgres.id',
      );
    });

    it('should use tsdevstack as admin login', () => {
      const result = generateDatabaseTf(baseConfig);
      expect(result).toContain('administrator_login           = "tsdevstack"');
    });

    it('should create random_password for admin', () => {
      const result = generateDatabaseTf(baseConfig);
      expect(result).toContain('resource "random_password" "db_admin"');
      expect(result).toContain('length  = 32');
      expect(result).toContain('special = false');
    });

    it('should use random_password for administrator_password', () => {
      const result = generateDatabaseTf(baseConfig);
      expect(result).toContain(
        'administrator_password        = random_password.db_admin.result',
      );
    });

    it('should use configured SKU', () => {
      const result = generateDatabaseTf(baseConfig);
      expect(result).toContain(
        'sku_name                      = "B_Standard_B1ms"',
      );
    });

    it('should convert storage GB to MB', () => {
      const result = generateDatabaseTf(baseConfig);
      // 32 GB * 1024 = 32768 MB
      expect(result).toContain('storage_mb                    = 32768');
    });

    it('should set 7-day backup retention when backup is false', () => {
      const result = generateDatabaseTf(baseConfig);
      expect(result).toContain('backup_retention_days         = 7');
    });

    it('should set 35-day backup retention when backup is true', () => {
      const config = {
        ...baseConfig,
        database: { ...baseConfig.database, backup: true },
      };
      const result = generateDatabaseTf(config);
      expect(result).toContain('backup_retention_days         = 35');
    });

    it('should disable geo-redundant backup', () => {
      const result = generateDatabaseTf(baseConfig);
      expect(result).toContain('geo_redundant_backup_enabled  = false');
    });

    it('should disable public network access', () => {
      const result = generateDatabaseTf(baseConfig);
      expect(result).toContain('public_network_access_enabled = false');
    });

    it('should depend on DNS zone VNet link', () => {
      const result = generateDatabaseTf(baseConfig);
      expect(result).toContain(
        'depends_on = [azurerm_private_dns_zone_virtual_network_link.postgres]',
      );
    });

    it('should apply tags', () => {
      const result = generateDatabaseTf(baseConfig);
      expect(result).toContain('tags                          = local.tags');
    });

    it('should ignore zone changes in lifecycle', () => {
      const result = generateDatabaseTf(baseConfig);
      expect(result).toContain(
        'ignore_changes = [zone, high_availability[0].standby_availability_zone]',
      );
    });
  });

  describe('per-service databases', () => {
    it('should create per-service databases resource', () => {
      const result = generateDatabaseTf(baseConfig);
      expect(result).toContain(
        'resource "azurerm_postgresql_flexible_server_database" "services"',
      );
    });

    it('should only include services with hasDatabase true', () => {
      const result = generateDatabaseTf(baseConfig);
      expect(result).toContain('"auth-service"');
      expect(result).toContain('"offers-service"');
      expect(result).not.toContain('"bff-service"');
    });

    it('should use UTF8 charset', () => {
      const result = generateDatabaseTf(baseConfig);
      expect(result).toContain('charset   = "UTF8"');
    });

    it('should use en_US.utf8 collation', () => {
      const result = generateDatabaseTf(baseConfig);
      expect(result).toContain('collation = "en_US.utf8"');
    });

    it('should reference the Flexible Server', () => {
      const result = generateDatabaseTf(baseConfig);
      expect(result).toContain(
        'server_id = azurerm_postgresql_flexible_server.main.id',
      );
    });
  });

  describe('SSL configuration', () => {
    it('should create require_secure_transport server configuration', () => {
      const result = generateDatabaseTf(baseConfig);
      expect(result).toContain(
        'resource "azurerm_postgresql_flexible_server_configuration" "require_ssl"',
      );
    });

    it('should set require_secure_transport to on', () => {
      const result = generateDatabaseTf(baseConfig);
      expect(result).toContain('name      = "require_secure_transport"');
      expect(result).toContain('value     = "on"');
    });

    it('should reference the Flexible Server for SSL config', () => {
      const result = generateDatabaseTf(baseConfig);
      const sslBlock = result.slice(
        result.indexOf(
          'resource "azurerm_postgresql_flexible_server_configuration"',
        ),
      );
      expect(sslBlock).toContain(
        'server_id = azurerm_postgresql_flexible_server.main.id',
      );
    });
  });

  describe('header comment', () => {
    it('should include generation comment', () => {
      const result = generateDatabaseTf(baseConfig);
      expect(result).toContain('Generated by: npx tsdevstack infra:generate');
    });
  });
});
