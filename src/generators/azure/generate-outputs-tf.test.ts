import { describe, it, expect } from '@rstest/core';
import { generateOutputsTf } from './generate-outputs-tf';
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
};

describe('generateOutputsTf', () => {
  it('should generate core output definitions', () => {
    const result = generateOutputsTf(baseConfig);

    expect(result).toContain('output "location"');
    expect(result).toContain('output "subscription_id"');
    expect(result).toContain('output "project_name"');
    expect(result).toContain('output "environment"');
    expect(result).toContain('output "resource_group_name"');
  });

  it('should reference resource group data source', () => {
    const result = generateOutputsTf(baseConfig);

    expect(result).toContain('data.azurerm_resource_group.main.name');
  });

  it('should output front_door_id', () => {
    const result = generateOutputsTf(baseConfig);

    expect(result).toContain('output "front_door_id"');
    expect(result).toContain('azurerm_cdn_frontdoor_profile.main.id');
  });

  it('should output front_door_resource_guid for FDID verification', () => {
    const result = generateOutputsTf(baseConfig);

    expect(result).toContain('output "front_door_resource_guid"');
    expect(result).toContain(
      'azurerm_cdn_frontdoor_profile.main.resource_guid',
    );
  });

  it('should output api_url', () => {
    const result = generateOutputsTf(baseConfig);

    expect(result).toContain('output "api_url"');
    expect(result).toContain('azurerm_cdn_frontdoor_endpoint.api.host_name');
  });

  it('should output acr_login_server', () => {
    const result = generateOutputsTf(baseConfig);

    expect(result).toContain('output "acr_login_server"');
    expect(result).toContain('azurerm_container_registry.main.login_server');
  });

  it('should output container_apps_env_id', () => {
    const result = generateOutputsTf(baseConfig);

    expect(result).toContain('output "container_apps_env_id"');
    expect(result).toContain('azurerm_container_app_environment.main.id');
  });

  it('should output container_apps_env_default_domain', () => {
    const result = generateOutputsTf(baseConfig);

    expect(result).toContain('output "container_apps_env_default_domain"');
    expect(result).toContain(
      'azurerm_container_app_environment.main.default_domain',
    );
  });

  it('should output container_apps_acr_identity_id', () => {
    const result = generateOutputsTf(baseConfig);

    expect(result).toContain('output "container_apps_acr_identity_id"');
    expect(result).toContain(
      'azurerm_user_assigned_identity.container_apps.id',
    );
  });

  it('should output container_apps_acr_identity_client_id', () => {
    const result = generateOutputsTf(baseConfig);

    expect(result).toContain('output "container_apps_acr_identity_client_id"');
    expect(result).toContain(
      'azurerm_user_assigned_identity.container_apps.client_id',
    );
  });

  describe('Redis outputs', () => {
    it('should output redis_host', () => {
      const result = generateOutputsTf(baseConfig);
      expect(result).toContain('output "redis_host"');
      expect(result).toContain('azurerm_managed_redis.main.hostname');
    });

    it('should output redis_port', () => {
      const result = generateOutputsTf(baseConfig);
      expect(result).toContain('output "redis_port"');
      expect(result).toContain(
        'azurerm_managed_redis.main.default_database[0].port',
      );
    });

    it('should output redis_password as sensitive', () => {
      const result = generateOutputsTf(baseConfig);
      expect(result).toContain('output "redis_password"');
      expect(result).toContain(
        'azurerm_managed_redis.main.default_database[0].primary_access_key',
      );
      // Verify sensitive flag is set on the redis_password output
      const redisPasswordBlock = result.slice(
        result.indexOf('output "redis_password"'),
        result.indexOf('# ===', result.indexOf('output "redis_password"') + 1),
      );
      expect(redisPasswordBlock).toContain('sensitive   = true');
    });
  });

  describe('Database outputs', () => {
    it('should output database_host', () => {
      const result = generateOutputsTf(baseConfig);
      expect(result).toContain('output "database_host"');
      expect(result).toContain('azurerm_postgresql_flexible_server.main.fqdn');
    });

    it('should output database_admin_password as sensitive', () => {
      const result = generateOutputsTf(baseConfig);
      expect(result).toContain('output "database_admin_password"');
      expect(result).toContain('random_password.db_admin.result');
      const dbPasswordBlock = result.slice(
        result.indexOf('output "database_admin_password"'),
      );
      expect(dbPasswordBlock).toContain('sensitive   = true');
    });
  });

  describe('SPA outputs', () => {
    const spaConfig: AzureInfraConfig = {
      ...baseConfig,
      spas: {
        'react-app': { domain: '' },
        'admin-panel': { domain: '' },
      },
    };

    it('should output storage account name per SPA', () => {
      const result = generateOutputsTf(spaConfig);
      expect(result).toContain('output "spa_react_app_storage_account"');
      expect(result).toContain('azurerm_storage_account.spa_react_app.name');
      expect(result).toContain('output "spa_admin_panel_storage_account"');
    });

    it('should output primary web host per SPA', () => {
      const result = generateOutputsTf(spaConfig);
      expect(result).toContain('output "spa_react_app_web_host"');
      expect(result).toContain(
        'azurerm_storage_account.spa_react_app.primary_web_host',
      );
    });

    it('should output Front Door endpoint hostname per SPA', () => {
      const result = generateOutputsTf(spaConfig);
      expect(result).toContain('output "spa_react_app_endpoint_hostname"');
      expect(result).toContain(
        'azurerm_cdn_frontdoor_endpoint.spa_react_app.host_name',
      );
    });

    it('should not include SPA section when no SPA services', () => {
      const result = generateOutputsTf(baseConfig);
      expect(result).not.toContain('SPA Hosting');
      expect(result).not.toContain('spa_');
    });
  });

  describe('App Service outputs', () => {
    it('should always output kong_app_service_name', () => {
      const result = generateOutputsTf(baseConfig);
      expect(result).toContain('output "kong_app_service_name"');
      expect(result).toContain('azurerm_linux_web_app.kong.name');
    });

    it('should output nextjs app service names per Next.js service', () => {
      const config: AzureInfraConfig = {
        ...baseConfig,
        frontends: {
          frontend: {
            domain: '',
            cpu: 0.5,
            memory: '1Gi',
            minInstances: 1,
            maxInstances: 5,
          },
        },
      };
      const result = generateOutputsTf(config);
      expect(result).toContain('output "nextjs_frontend_app_service_name"');
      expect(result).toContain('azurerm_linux_web_app.nextjs_frontend.name');
    });

    it('should not include nextjs outputs when no Next.js services', () => {
      const result = generateOutputsTf(baseConfig);
      expect(result).not.toContain('nextjs_');
    });

    it('should include App Service section header', () => {
      const result = generateOutputsTf(baseConfig);
      expect(result).toContain('# App Service');
    });
  });
});
