import { describe, it, expect } from '@rstest/core';
import { generateAppServiceTf } from './generate-app-service-tf';
import type { AzureInfraConfig } from '../../types/config.ts';

function makeConfig(
  overrides: Partial<AzureInfraConfig> = {},
): AzureInfraConfig {
  return {
    provider: 'azure',
    projectName: 'testproject',
    environment: 'dev',
    subscriptionId: 'sub-123',
    location: 'eastus2',
    storageAccountName: 'testprojectdevtfstate',
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
    ...overrides,
  };
}

describe('generateAppServiceTf', () => {
  describe('Kong App Service', () => {
    it('should generate Kong App Service Plan', () => {
      const result = generateAppServiceTf(makeConfig());
      expect(result).toContain('resource "azurerm_service_plan" "kong"');
      expect(result).toContain(
        'sku_name            = var.kong_app_service_sku',
      );
    });

    it('should generate Kong Linux Web App', () => {
      const result = generateAppServiceTf(makeConfig());
      expect(result).toContain('resource "azurerm_linux_web_app" "kong"');
    });

    it('should set ip_restriction_default_action to Deny', () => {
      const result = generateAppServiceTf(makeConfig());
      expect(result).toContain(
        'ip_restriction_default_action           = "Deny"',
      );
    });

    it('should set scm_use_main_ip_restriction to true', () => {
      const result = generateAppServiceTf(makeConfig());
      expect(result).toContain(
        'scm_use_main_ip_restriction             = true',
      );
    });

    it('should include all four headers sub-fields', () => {
      const result = generateAppServiceTf(makeConfig());
      expect(result).toContain('x_azure_fdid');
      expect(result).toContain('x_fd_health_probe');
      expect(result).toContain('x_forwarded_for');
      expect(result).toContain('x_forwarded_host');
    });

    it('should enable container_registry_use_managed_identity', () => {
      const result = generateAppServiceTf(makeConfig());
      expect(result).toContain(
        'container_registry_use_managed_identity = true',
      );
    });

    it('should set VNet integration subnet', () => {
      const result = generateAppServiceTf(makeConfig());
      expect(result).toContain(
        'virtual_network_subnet_id = azurerm_subnet.app_service_integration.id',
      );
    });

    it('should set WEBSITES_PORT to 8080', () => {
      const result = generateAppServiceTf(makeConfig());
      expect(result).toContain('WEBSITES_PORT');
      expect(result).toContain('"8080"');
    });

    it('should generate Kong ACR pull role assignment', () => {
      const result = generateAppServiceTf(makeConfig());
      expect(result).toContain(
        'resource "azurerm_role_assignment" "kong_acr_pull"',
      );
      expect(result).toContain('role_definition_name             = "AcrPull"');
    });

    it('should generate Kong Key Vault role assignment', () => {
      const result = generateAppServiceTf(makeConfig());
      expect(result).toContain(
        'resource "azurerm_role_assignment" "kong_keyvault"',
      );
      expect(result).toContain(
        'role_definition_name             = "Key Vault Secrets User"',
      );
    });

    it('should set skip_service_principal_aad_check on role assignments', () => {
      const result = generateAppServiceTf(makeConfig());
      expect(result).toContain('skip_service_principal_aad_check = true');
    });
  });

  describe('Next.js App Service', () => {
    it('should not generate Next.js plan when no Next.js services', () => {
      const result = generateAppServiceTf(makeConfig({ frontends: {} }));
      expect(result).not.toContain('resource "azurerm_service_plan" "nextjs"');
    });

    it('should generate Next.js plan when Next.js services exist', () => {
      const result = generateAppServiceTf(
        makeConfig({
          frontends: {
            frontend: {
              domain: '',
              cpu: 1,
              memory: '1Gi',
              minInstances: 0,
              maxInstances: 5,
            },
          },
        }),
      );
      expect(result).toContain('resource "azurerm_service_plan" "nextjs"');
      expect(result).toContain(
        'sku_name            = var.nextjs_app_service_sku',
      );
    });

    it('should generate per-service Next.js web app', () => {
      const result = generateAppServiceTf(
        makeConfig({
          frontends: {
            frontend: {
              domain: '',
              cpu: 1,
              memory: '1Gi',
              minInstances: 0,
              maxInstances: 5,
            },
          },
        }),
      );
      expect(result).toContain(
        'resource "azurerm_linux_web_app" "nextjs_frontend"',
      );
      expect(result).toContain('docker_image_name   = "frontend:latest"');
    });

    it('should generate role assignments for each Next.js service', () => {
      const result = generateAppServiceTf(
        makeConfig({
          frontends: {
            frontend: {
              domain: '',
              cpu: 1,
              memory: '1Gi',
              minInstances: 0,
              maxInstances: 5,
            },
          },
        }),
      );
      expect(result).toContain(
        'resource "azurerm_role_assignment" "nextjs_frontend_acr_pull"',
      );
      expect(result).toContain(
        'resource "azurerm_role_assignment" "nextjs_frontend_keyvault"',
      );
    });

    it('should handle multiple Next.js services', () => {
      const result = generateAppServiceTf(
        makeConfig({
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
        }),
      );
      expect(result).toContain(
        'resource "azurerm_linux_web_app" "nextjs_frontend"',
      );
      expect(result).toContain(
        'resource "azurerm_linux_web_app" "nextjs_admin_panel"',
      );
      expect(result).toContain('docker_image_name   = "admin-panel:latest"');
    });

    it('should use application_stack block (not deprecated linux_fx_version)', () => {
      const result = generateAppServiceTf(makeConfig());
      expect(result).toContain('application_stack');
      expect(result).not.toContain('linux_fx_version');
    });
  });

  describe('security hardening', () => {
    it('should set https_only on Kong web app', () => {
      const result = generateAppServiceTf(makeConfig());
      const kongBlock = result.slice(
        result.indexOf('resource "azurerm_linux_web_app" "kong"'),
        result.indexOf(
          '# =',
          result.indexOf('resource "azurerm_linux_web_app" "kong"') + 1,
        ),
      );
      expect(kongBlock).toContain('https_only                = true');
    });

    it('should set minimum_tls_version on Kong web app', () => {
      const result = generateAppServiceTf(makeConfig());
      expect(result).toContain(
        'minimum_tls_version                     = "1.2"',
      );
    });

    it('should set ftps_state to Disabled on Kong web app', () => {
      const result = generateAppServiceTf(makeConfig());
      expect(result).toContain(
        'ftps_state                              = "Disabled"',
      );
    });

    it('should enable http2 on Kong web app', () => {
      const result = generateAppServiceTf(makeConfig());
      expect(result).toContain(
        'http2_enabled                           = true',
      );
    });

    it('should set https_only on Next.js web app', () => {
      const result = generateAppServiceTf(
        makeConfig({
          frontends: {
            frontend: {
              domain: '',
              cpu: 1,
              memory: '1Gi',
              minInstances: 0,
              maxInstances: 5,
            },
          },
        }),
      );
      const nextjsBlock = result.slice(
        result.indexOf('resource "azurerm_linux_web_app" "nextjs_frontend"'),
      );
      expect(nextjsBlock).toContain('https_only                = true');
    });

    it('should set security site_config on Next.js web app', () => {
      const result = generateAppServiceTf(
        makeConfig({
          frontends: {
            frontend: {
              domain: '',
              cpu: 1,
              memory: '1Gi',
              minInstances: 0,
              maxInstances: 5,
            },
          },
        }),
      );
      const nextjsBlock = result.slice(
        result.indexOf('resource "azurerm_linux_web_app" "nextjs_frontend"'),
      );
      expect(nextjsBlock).toContain('minimum_tls_version');
      expect(nextjsBlock).toContain('ftps_state');
      expect(nextjsBlock).toContain('http2_enabled');
    });
  });

  describe('lifecycle ignore_changes', () => {
    it('should ignore app_settings and docker_image_name on Kong web app', () => {
      const result = generateAppServiceTf(makeConfig());
      const kongBlock = result.slice(
        result.indexOf('resource "azurerm_linux_web_app" "kong"'),
        result.indexOf(
          '# =',
          result.indexOf('resource "azurerm_linux_web_app" "kong"') + 1,
        ),
      );
      expect(kongBlock).toContain('lifecycle {');
      expect(kongBlock).toContain('ignore_changes');
      expect(kongBlock).toContain('app_settings');
      expect(kongBlock).toContain('docker_image_name');
    });

    it('should ignore app_settings and docker_image_name on Next.js web apps', () => {
      const result = generateAppServiceTf(
        makeConfig({
          frontends: {
            frontend: {
              domain: '',
              cpu: 1,
              memory: '1Gi',
              minInstances: 0,
              maxInstances: 5,
            },
          },
        }),
      );
      const nextjsBlock = result.slice(
        result.indexOf('resource "azurerm_linux_web_app" "nextjs_frontend"'),
      );
      expect(nextjsBlock).toContain('lifecycle {');
      expect(nextjsBlock).toContain('ignore_changes');
      expect(nextjsBlock).toContain('app_settings');
      expect(nextjsBlock).toContain('docker_image_name');
    });
  });

  describe('Front Door Premium', () => {
    it('should not include public_network_access_enabled in Terraform (managed via SDK post-deploy)', () => {
      const result = generateAppServiceTf(
        makeConfig({ frontdoorPremium: true }),
      );
      expect(result).not.toContain('public_network_access_enabled');
    });
  });
});
