import { describe, it, expect } from '@rstest/core';
import { generateDiagnosticsTf } from './generate-diagnostics-tf';
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

describe('generateDiagnosticsTf', () => {
  describe('Front Door diagnostics', () => {
    it('should create Front Door diagnostic setting', () => {
      const result = generateDiagnosticsTf(baseConfig);
      expect(result).toContain(
        'resource "azurerm_monitor_diagnostic_setting" "frontdoor"',
      );
    });

    it('should target the Front Door profile', () => {
      const result = generateDiagnosticsTf(baseConfig);
      expect(result).toContain(
        'target_resource_id         = azurerm_cdn_frontdoor_profile.main.id',
      );
    });

    it('should enable FrontDoorAccessLog', () => {
      const result = generateDiagnosticsTf(baseConfig);
      expect(result).toContain('category = "FrontDoorAccessLog"');
    });

    it('should enable FrontDoorHealthProbeLog', () => {
      const result = generateDiagnosticsTf(baseConfig);
      expect(result).toContain('category = "FrontDoorHealthProbeLog"');
    });

    it('should enable FrontDoorWebApplicationFirewallLog', () => {
      const result = generateDiagnosticsTf(baseConfig);
      expect(result).toContain(
        'category = "FrontDoorWebApplicationFirewallLog"',
      );
    });
  });

  describe('PostgreSQL diagnostics', () => {
    it('should create PostgreSQL diagnostic setting', () => {
      const result = generateDiagnosticsTf(baseConfig);
      expect(result).toContain(
        'resource "azurerm_monitor_diagnostic_setting" "postgres"',
      );
    });

    it('should target the PostgreSQL Flexible Server', () => {
      const result = generateDiagnosticsTf(baseConfig);
      expect(result).toContain(
        'target_resource_id         = azurerm_postgresql_flexible_server.main.id',
      );
    });

    it('should send to Log Analytics workspace', () => {
      const result = generateDiagnosticsTf(baseConfig);
      expect(result).toContain(
        'log_analytics_workspace_id = azurerm_log_analytics_workspace.main.id',
      );
    });

    it('should enable PostgreSQLLogs category', () => {
      const result = generateDiagnosticsTf(baseConfig);
      expect(result).toContain('category = "PostgreSQLLogs"');
    });

    it('should enable PostgreSQLFlexQueryStoreRuntime category', () => {
      const result = generateDiagnosticsTf(baseConfig);
      expect(result).toContain('category = "PostgreSQLFlexQueryStoreRuntime"');
    });
  });

  describe('Kong App Service diagnostics', () => {
    it('should create Kong diagnostic setting', () => {
      const result = generateDiagnosticsTf(baseConfig);
      expect(result).toContain(
        'resource "azurerm_monitor_diagnostic_setting" "kong"',
      );
    });

    it('should target Kong web app', () => {
      const result = generateDiagnosticsTf(baseConfig);
      const kongBlock = result.slice(
        result.indexOf('resource "azurerm_monitor_diagnostic_setting" "kong"'),
      );
      expect(kongBlock).toContain(
        'target_resource_id         = azurerm_linux_web_app.kong.id',
      );
    });

    it('should enable AppServiceHTTPLogs', () => {
      const result = generateDiagnosticsTf(baseConfig);
      expect(result).toContain('category = "AppServiceHTTPLogs"');
    });

    it('should enable AppServiceConsoleLogs', () => {
      const result = generateDiagnosticsTf(baseConfig);
      expect(result).toContain('category = "AppServiceConsoleLogs"');
    });

    it('should enable AppServiceAuditLogs', () => {
      const result = generateDiagnosticsTf(baseConfig);
      expect(result).toContain('category = "AppServiceAuditLogs"');
    });
  });

  describe('Next.js App Service diagnostics', () => {
    it('should not include Next.js diagnostics when no Next.js services', () => {
      const result = generateDiagnosticsTf(baseConfig);
      expect(result).not.toContain('nextjs_');
    });

    it('should create diagnostic setting for each Next.js service', () => {
      const config: AzureInfraConfig = {
        ...baseConfig,
        frontends: {
          frontend: {
            domain: '',
            cpu: 1,
            memory: '1Gi',
            minInstances: 0,
            maxInstances: 5,
          },
        },
      };
      const result = generateDiagnosticsTf(config);
      expect(result).toContain(
        'resource "azurerm_monitor_diagnostic_setting" "nextjs_frontend"',
      );
    });

    it('should target the correct Next.js web app', () => {
      const config: AzureInfraConfig = {
        ...baseConfig,
        frontends: {
          frontend: {
            domain: '',
            cpu: 1,
            memory: '1Gi',
            minInstances: 0,
            maxInstances: 5,
          },
        },
      };
      const result = generateDiagnosticsTf(config);
      const nextjsBlock = result.slice(
        result.indexOf(
          'resource "azurerm_monitor_diagnostic_setting" "nextjs_frontend"',
        ),
      );
      expect(nextjsBlock).toContain(
        'target_resource_id         = azurerm_linux_web_app.nextjs_frontend.id',
      );
    });

    it('should handle multiple Next.js services', () => {
      const config: AzureInfraConfig = {
        ...baseConfig,
        frontends: {
          frontend: {
            domain: '',
            cpu: 1,
            memory: '1Gi',
            minInstances: 0,
            maxInstances: 5,
          },
          'admin-panel': {
            domain: '',
            cpu: 1,
            memory: '1Gi',
            minInstances: 0,
            maxInstances: 3,
          },
        },
      };
      const result = generateDiagnosticsTf(config);
      expect(result).toContain(
        'resource "azurerm_monitor_diagnostic_setting" "nextjs_frontend"',
      );
      expect(result).toContain(
        'resource "azurerm_monitor_diagnostic_setting" "nextjs_admin_panel"',
      );
    });
  });

  describe('uses enabled_log block', () => {
    it('should use enabled_log (not deprecated log block)', () => {
      const result = generateDiagnosticsTf(baseConfig);
      expect(result).toContain('enabled_log {');
      expect(result).not.toMatch(/^\s+log\s*\{/m);
    });
  });

  describe('header comment', () => {
    it('should include generation comment', () => {
      const result = generateDiagnosticsTf(baseConfig);
      expect(result).toContain('Generated by: npx tsdevstack infra:generate');
    });
  });
});
