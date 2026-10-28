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
    keyVaultName: 'myproject-dev-kv',
    serviceKeyVaults: {},
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
    kongScaling: { instances: 1, autoscaleMax: null },
    nextjsScaling: { instances: 1, autoscaleMax: null },
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

    it('should make Kong read the client address from X-Azure-SocketIP sent through App Service', () => {
      const result = generateAppServiceTf(makeConfig());
      expect(result).toContain(
        '    KONG_DECLARATIVE_CONFIG             = "/kong/declarative/kong.yml"\n    KONG_TRUSTED_IPS                    = "169.254.0.0/16"\n    KONG_REAL_IP_HEADER                 = "X-Azure-SocketIP"\n    KONG_REAL_IP_RECURSIVE              = "off"\n  }',
      );
    });

    it('should not set the Kong client address settings on Next.js web apps', () => {
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
      expect(nextjsBlock).not.toContain('KONG_TRUSTED_IPS');
      expect(nextjsBlock).not.toContain('KONG_REAL_IP_HEADER');
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

    it('should not give Kong Key Vault access (it reads no secrets)', () => {
      const result = generateAppServiceTf(makeConfig());
      expect(result).not.toContain('kong_keyvault');
      expect(result).not.toContain('Key Vault Secrets User');
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
      expect(result).not.toContain('nextjs_frontend_keyvault');
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

  describe('Kong private endpoint', () => {
    const withNextjs = makeConfig({
      frontends: {
        frontend: {
          domain: '',
          cpu: 1,
          memory: '1Gi',
          minInstances: 1,
          maxInstances: 1,
        },
      },
    });

    it('should give Kong a private endpoint in the private endpoints subnet with Next.js apps', () => {
      const result = generateAppServiceTf(withNextjs);
      const endpoint = result.slice(
        result.indexOf('resource "azurerm_private_endpoint" "kong"'),
      );

      expect(endpoint).toContain(
        'name                = "${var.project_name}-${var.environment}-kong-pe"',
      );
      expect(endpoint).toContain(
        'subnet_id           = azurerm_subnet.private_endpoints.id',
      );
      expect(endpoint).toContain(
        'private_connection_resource_id = azurerm_linux_web_app.kong.id',
      );
      expect(endpoint).toContain('subresource_names              = ["sites"]');
      expect(endpoint).toContain('is_manual_connection           = false');
      expect(endpoint).toContain(
        'private_dns_zone_ids = [azurerm_private_dns_zone.app_service.id]',
      );
    });

    it('should resolve Kong to the endpoint in the VNet and other apps publicly', () => {
      const result = generateAppServiceTf(withNextjs);

      expect(result).toContain(
        'name                = "privatelink.azurewebsites.net"',
      );
      const link = result.slice(
        result.indexOf(
          'resource "azurerm_private_dns_zone_virtual_network_link" "app_service"',
        ),
      );
      expect(link).toContain(
        'virtual_network_id    = azurerm_virtual_network.main.id',
      );
      expect(link).toContain('resolution_policy     = "NxDomainRedirect"');
    });

    it('should not create the endpoint or its DNS zone without Next.js apps', () => {
      const result = generateAppServiceTf(makeConfig());

      expect(result).not.toContain('azurerm_private_endpoint');
      expect(result).not.toContain('privatelink.azurewebsites.net');
    });

    it("should leave Kong's public access to Front Door as it is", () => {
      const result = generateAppServiceTf(withNextjs);

      expect(result).not.toContain('public_network_access_enabled');
      expect(result).toContain('service_tag = "AzureFrontDoor.Backend"');
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

  describe('Instances and scaling', () => {
    const withFrontend = (
      overrides: Partial<AzureInfraConfig> = {},
    ): AzureInfraConfig =>
      makeConfig({
        frontends: {
          frontend: {
            domain: '',
            cpu: 1,
            memory: '1Gi',
            minInstances: 2,
            maxInstances: 2,
          },
        },
        ...overrides,
      });

    const kongPlan = (result: string): string =>
      result.slice(
        result.indexOf('resource "azurerm_service_plan" "kong"'),
        result.indexOf('resource "azurerm_linux_web_app" "kong"'),
      );

    const kongApp = (result: string): string =>
      result.slice(
        result.indexOf('resource "azurerm_linux_web_app" "kong"'),
        result.indexOf('# Role Assignments'),
      );

    it('should run minInstances workers on each plan', () => {
      const result = generateAppServiceTf(
        withFrontend({
          kongScaling: { instances: 2, autoscaleMax: null },
          nextjsScaling: { instances: 3, autoscaleMax: null },
        }),
      );
      expect(kongPlan(result)).toContain('worker_count        = 2');
      const nextjsPlan = result.slice(
        result.indexOf('resource "azurerm_service_plan" "nextjs"'),
        result.indexOf('# Kong Web App'),
      );
      expect(nextjsPlan).toContain('worker_count        = 3');
    });

    it('should let autoscale own the count of a plan that autoscales', () => {
      const result = generateAppServiceTf(
        withFrontend({
          kongScaling: { instances: 1, autoscaleMax: 4 },
        }),
      );
      expect(kongPlan(result)).toContain('ignore_changes = [worker_count]');
      const nextjsPlan = result.slice(
        result.indexOf('resource "azurerm_service_plan" "nextjs"'),
        result.indexOf('# Kong Web App'),
      );
      expect(nextjsPlan).not.toContain('ignore_changes');
    });

    it('should keep Terraform in charge of the count without autoscale', () => {
      const result = generateAppServiceTf(makeConfig());
      expect(kongPlan(result)).not.toContain('ignore_changes');
    });

    it('should turn session affinity off on every web app', () => {
      const result = generateAppServiceTf(withFrontend());
      expect(result.match(/client_affinity_enabled {3}= false/g)).toHaveLength(
        2,
      );
    });

    it('should add a health check when a plan runs more than one instance', () => {
      const result = generateAppServiceTf(
        withFrontend({
          kongScaling: { instances: 2, autoscaleMax: null },
          nextjsScaling: { instances: 2, autoscaleMax: null },
        }),
      );
      expect(kongApp(result)).toContain(
        'health_check_path                       = "/status"',
      );
      expect(kongApp(result)).toContain(
        'health_check_eviction_time_in_min       = 2',
      );
      const nextjsApp = result.slice(
        result.indexOf('resource "azurerm_linux_web_app" "nextjs_frontend"'),
      );
      expect(nextjsApp).toContain(
        'health_check_path                       = "/health"',
      );
    });

    it('should add a health check when a plan autoscales from one instance', () => {
      const result = generateAppServiceTf(
        makeConfig({ kongScaling: { instances: 1, autoscaleMax: 3 } }),
      );
      expect(kongApp(result)).toContain('health_check_path');
    });

    it('should not add a health check to a single fixed instance', () => {
      const result = generateAppServiceTf(
        withFrontend({
          nextjsScaling: { instances: 1, autoscaleMax: null },
        }),
      );
      expect(result).not.toContain('health_check_path');
    });
  });
});
