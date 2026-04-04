import { describe, it, expect } from '@rstest/core';
import { generateFrontdoorTf } from './generate-frontdoor-tf';
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

describe('generateFrontdoorTf', () => {
  describe('Front Door Profile', () => {
    it('should create profile resource', () => {
      const result = generateFrontdoorTf(baseConfig);
      expect(result).toContain(
        'resource "azurerm_cdn_frontdoor_profile" "main"',
      );
    });

    it('should use Standard_AzureFrontDoor SKU', () => {
      const result = generateFrontdoorTf(baseConfig);
      expect(result).toContain(
        'sku_name            = "Standard_AzureFrontDoor"',
      );
    });

    it('should reference resource group data source', () => {
      const result = generateFrontdoorTf(baseConfig);
      const profileBlock = result.slice(
        result.indexOf('resource "azurerm_cdn_frontdoor_profile" "main"'),
        result.indexOf('resource "azurerm_cdn_frontdoor_security_policy"'),
      );
      expect(profileBlock).toContain(
        'resource_group_name = data.azurerm_resource_group.main.name',
      );
    });

    it('should apply tags', () => {
      const result = generateFrontdoorTf(baseConfig);
      const profileBlock = result.slice(
        result.indexOf('resource "azurerm_cdn_frontdoor_profile" "main"'),
        result.indexOf('resource "azurerm_cdn_frontdoor_security_policy"'),
      );
      expect(profileBlock).toContain('tags                = local.tags');
    });
  });

  describe('Security Policy', () => {
    it('should create security policy resource', () => {
      const result = generateFrontdoorTf(baseConfig);
      expect(result).toContain(
        'resource "azurerm_cdn_frontdoor_security_policy" "main"',
      );
    });

    it('should link to Front Door profile', () => {
      const result = generateFrontdoorTf(baseConfig);
      expect(result).toContain(
        'cdn_frontdoor_profile_id = azurerm_cdn_frontdoor_profile.main.id',
      );
    });

    it('should link to WAF policy', () => {
      const result = generateFrontdoorTf(baseConfig);
      expect(result).toContain(
        'cdn_frontdoor_firewall_policy_id = azurerm_cdn_frontdoor_firewall_policy.main.id',
      );
    });

    it('should apply to all paths', () => {
      const result = generateFrontdoorTf(baseConfig);
      expect(result).toContain('patterns_to_match = ["/*"]');
    });

    it('should associate with api endpoint', () => {
      const result = generateFrontdoorTf(baseConfig);
      expect(result).toContain(
        'cdn_frontdoor_domain_id = azurerm_cdn_frontdoor_endpoint.api.id',
      );
    });

    it('should associate with nextjs endpoint when Next.js services exist', () => {
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
      const result = generateFrontdoorTf(config);
      expect(result).toContain(
        'cdn_frontdoor_domain_id = azurerm_cdn_frontdoor_endpoint.nextjs_frontend.id',
      );
    });

    it('should not associate with nextjs endpoint when no Next.js services', () => {
      const result = generateFrontdoorTf(baseConfig);
      expect(result).not.toContain(
        'cdn_frontdoor_domain_id = azurerm_cdn_frontdoor_endpoint.nextjs_frontend.id',
      );
    });
  });

  describe('Endpoints', () => {
    it('should create api endpoint', () => {
      const result = generateFrontdoorTf(baseConfig);
      expect(result).toContain(
        'resource "azurerm_cdn_frontdoor_endpoint" "api"',
      );
    });

    it('should create nextjs endpoint when Next.js services exist', () => {
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
      const result = generateFrontdoorTf(config);
      expect(result).toContain(
        'resource "azurerm_cdn_frontdoor_endpoint" "nextjs_frontend"',
      );
    });

    it('should not create nextjs endpoint when no Next.js services', () => {
      const result = generateFrontdoorTf(baseConfig);
      expect(result).not.toContain(
        'resource "azurerm_cdn_frontdoor_endpoint" "nextjs_frontend"',
      );
    });

    it('should apply tags to api endpoint', () => {
      const result = generateFrontdoorTf(baseConfig);
      const apiBlock = result.slice(
        result.indexOf('resource "azurerm_cdn_frontdoor_endpoint" "api"'),
        result.indexOf(
          '# =====',
          result.indexOf('resource "azurerm_cdn_frontdoor_endpoint" "api"') + 1,
        ),
      );
      expect(apiBlock).toContain('tags                     = local.tags');
    });
  });

  describe('Origin Groups', () => {
    it('should create api origin group', () => {
      const result = generateFrontdoorTf(baseConfig);
      expect(result).toContain(
        'resource "azurerm_cdn_frontdoor_origin_group" "api"',
      );
    });

    it('should create nextjs origin group when Next.js services exist', () => {
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
      const result = generateFrontdoorTf(config);
      expect(result).toContain(
        'resource "azurerm_cdn_frontdoor_origin_group" "nextjs_frontend"',
      );
    });

    it('should not create nextjs origin group when no Next.js services', () => {
      const result = generateFrontdoorTf(baseConfig);
      expect(result).not.toContain(
        'resource "azurerm_cdn_frontdoor_origin_group" "nextjs_frontend"',
      );
    });

    it('should disable session affinity', () => {
      const result = generateFrontdoorTf(baseConfig);
      expect(result).toContain('session_affinity_enabled = false');
    });

    it('should configure api health probe with /status path', () => {
      const result = generateFrontdoorTf(baseConfig);
      const apiGroupStart = result.indexOf(
        'resource "azurerm_cdn_frontdoor_origin_group" "api"',
      );
      const originsStart = result.indexOf('# Origins', apiGroupStart);
      const apiBlock = result.slice(apiGroupStart, originsStart);
      expect(apiBlock).toContain('path                = "/status"');
    });

    it('should configure nextjs health probe with / path', () => {
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
      const result = generateFrontdoorTf(config);
      const nextjsBlock = result.slice(
        result.indexOf(
          'resource "azurerm_cdn_frontdoor_origin_group" "nextjs_frontend"',
        ),
      );
      expect(nextjsBlock).toContain('path                = "/"');
    });

    it('should use Https protocol for health probes', () => {
      const result = generateFrontdoorTf(baseConfig);
      expect(result).toContain('protocol            = "Https"');
    });

    it('should use HEAD request type for health probes', () => {
      const result = generateFrontdoorTf(baseConfig);
      expect(result).toContain('request_type        = "HEAD"');
    });

    it('should set 30 second health probe intervals', () => {
      const result = generateFrontdoorTf(baseConfig);
      expect(result).toContain('interval_in_seconds = 30');
    });

    it('should configure load balancing', () => {
      const result = generateFrontdoorTf(baseConfig);
      expect(result).toContain('sample_size                 = 4');
      expect(result).toContain('successful_samples_required = 3');
    });
  });

  describe('SPA services', () => {
    const spaConfig: AzureInfraConfig = {
      ...baseConfig,
      spas: {
        'react-app': { domain: '' },
        'admin-panel': { domain: '' },
      },
    };

    it('should create endpoint per SPA', () => {
      const result = generateFrontdoorTf(spaConfig);
      expect(result).toContain(
        'resource "azurerm_cdn_frontdoor_endpoint" "spa_react_app"',
      );
      expect(result).toContain(
        'resource "azurerm_cdn_frontdoor_endpoint" "spa_admin_panel"',
      );
    });

    it('should create origin group per SPA', () => {
      const result = generateFrontdoorTf(spaConfig);
      expect(result).toContain(
        'resource "azurerm_cdn_frontdoor_origin_group" "spa_react_app"',
      );
      expect(result).toContain(
        'resource "azurerm_cdn_frontdoor_origin_group" "spa_admin_panel"',
      );
    });

    it('should include SPA endpoints in security policy', () => {
      const result = generateFrontdoorTf(spaConfig);
      expect(result).toContain(
        'cdn_frontdoor_domain_id = azurerm_cdn_frontdoor_endpoint.spa_react_app.id',
      );
      expect(result).toContain(
        'cdn_frontdoor_domain_id = azurerm_cdn_frontdoor_endpoint.spa_admin_panel.id',
      );
    });

    it('should configure SPA health probes with / path', () => {
      const result = generateFrontdoorTf(spaConfig);
      const spaBlock = result.slice(
        result.indexOf(
          'resource "azurerm_cdn_frontdoor_origin_group" "spa_react_app"',
        ),
        result.indexOf(
          'resource "azurerm_cdn_frontdoor_origin_group" "spa_admin_panel"',
        ),
      );
      expect(spaBlock).toContain('path                = "/"');
      expect(spaBlock).toContain('protocol            = "Https"');
      expect(spaBlock).toContain('request_type        = "HEAD"');
    });

    it('should not create SPA resources when no SPA services', () => {
      const result = generateFrontdoorTf(baseConfig);
      expect(result).not.toContain('spa_react_app');
      expect(result).not.toContain('spa_admin_panel');
    });
  });

  describe('Multiple Next.js services', () => {
    const multiNextjsConfig: AzureInfraConfig = {
      ...baseConfig,
      frontends: {
        frontend: {
          domain: '',
          cpu: 0.5,
          memory: '1Gi',
          minInstances: 1,
          maxInstances: 5,
        },
        dashboard: {
          domain: '',
          cpu: 0.5,
          memory: '1Gi',
          minInstances: 0,
          maxInstances: 3,
        },
      },
    };

    it('should create endpoint per Next.js service', () => {
      const result = generateFrontdoorTf(multiNextjsConfig);
      expect(result).toContain(
        'resource "azurerm_cdn_frontdoor_endpoint" "nextjs_frontend"',
      );
      expect(result).toContain(
        'resource "azurerm_cdn_frontdoor_endpoint" "nextjs_dashboard"',
      );
    });

    it('should create origin group per Next.js service', () => {
      const result = generateFrontdoorTf(multiNextjsConfig);
      expect(result).toContain(
        'resource "azurerm_cdn_frontdoor_origin_group" "nextjs_frontend"',
      );
      expect(result).toContain(
        'resource "azurerm_cdn_frontdoor_origin_group" "nextjs_dashboard"',
      );
    });

    it('should create origin per Next.js service', () => {
      const result = generateFrontdoorTf(multiNextjsConfig);
      expect(result).toContain(
        'resource "azurerm_cdn_frontdoor_origin" "nextjs_frontend"',
      );
      expect(result).toContain(
        'resource "azurerm_cdn_frontdoor_origin" "nextjs_dashboard"',
      );
    });

    it('should create route per Next.js service', () => {
      const result = generateFrontdoorTf(multiNextjsConfig);
      expect(result).toContain(
        'resource "azurerm_cdn_frontdoor_route" "nextjs_frontend"',
      );
      expect(result).toContain(
        'resource "azurerm_cdn_frontdoor_route" "nextjs_dashboard"',
      );
    });

    it('should include all Next.js endpoints in security policy', () => {
      const result = generateFrontdoorTf(multiNextjsConfig);
      expect(result).toContain(
        'cdn_frontdoor_domain_id = azurerm_cdn_frontdoor_endpoint.nextjs_frontend.id',
      );
      expect(result).toContain(
        'cdn_frontdoor_domain_id = azurerm_cdn_frontdoor_endpoint.nextjs_dashboard.id',
      );
    });

    it('should reference correct App Service hostname per service', () => {
      const result = generateFrontdoorTf(multiNextjsConfig);
      expect(result).toContain(
        'azurerm_linux_web_app.nextjs_frontend.default_hostname',
      );
      expect(result).toContain(
        'azurerm_linux_web_app.nextjs_dashboard.default_hostname',
      );
    });
  });

  describe('Custom domain security associations', () => {
    it('should not include custom domain associations when baseDomain is empty', () => {
      const result = generateFrontdoorTf(baseConfig);
      expect(result).not.toContain('azurerm_cdn_frontdoor_custom_domain');
    });

    it('should include API custom domain in security policy when baseDomain is set', () => {
      const result = generateFrontdoorTf({
        ...baseConfig,
        baseDomain: 'example.com',
      });
      expect(result).toContain(
        'cdn_frontdoor_domain_id = azurerm_cdn_frontdoor_custom_domain.api.id',
      );
    });

    it('should include nextjs custom domain when baseDomain and frontends are set', () => {
      const result = generateFrontdoorTf({
        ...baseConfig,
        baseDomain: 'example.com',
        frontends: {
          frontend: {
            domain: 'frontend.example.com',
            cpu: 0.5,
            memory: '1Gi',
            minInstances: 1,
            maxInstances: 5,
          },
        },
      });
      expect(result).toContain(
        'cdn_frontdoor_domain_id = azurerm_cdn_frontdoor_custom_domain.nextjs_frontend.id',
      );
    });

    it('should not include nextjs custom domain when baseDomain is set but no frontends', () => {
      const result = generateFrontdoorTf({
        ...baseConfig,
        baseDomain: 'example.com',
      });
      expect(result).not.toContain(
        'azurerm_cdn_frontdoor_custom_domain.nextjs_frontend.id',
      );
    });

    it('should include SPA custom domains in security policy when baseDomain is set', () => {
      const result = generateFrontdoorTf({
        ...baseConfig,
        baseDomain: 'example.com',
        spas: {
          'react-app': { domain: 'react-app.example.com' },
        },
      });
      expect(result).toContain(
        'cdn_frontdoor_domain_id = azurerm_cdn_frontdoor_custom_domain.spa_react_app.id',
      );
    });

    it('should include all nextjs custom domains when multiple services', () => {
      const result = generateFrontdoorTf({
        ...baseConfig,
        baseDomain: 'example.com',
        frontends: {
          frontend: {
            domain: 'frontend.example.com',
            cpu: 0.5,
            memory: '1Gi',
            minInstances: 1,
            maxInstances: 5,
          },
          dashboard: {
            domain: 'dashboard.example.com',
            cpu: 0.5,
            memory: '1Gi',
            minInstances: 0,
            maxInstances: 3,
          },
        },
      });
      expect(result).toContain(
        'cdn_frontdoor_domain_id = azurerm_cdn_frontdoor_custom_domain.nextjs_frontend.id',
      );
      expect(result).toContain(
        'cdn_frontdoor_domain_id = azurerm_cdn_frontdoor_custom_domain.nextjs_dashboard.id',
      );
    });
  });

  describe('Origins', () => {
    it('should create API origin pointing to Kong App Service', () => {
      const result = generateFrontdoorTf(baseConfig);
      expect(result).toContain('resource "azurerm_cdn_frontdoor_origin" "api"');
      expect(result).toContain(
        'host_name                      = "${azurerm_linux_web_app.kong.default_hostname}"',
      );
    });

    it('should set API origin host header to match hostname', () => {
      const result = generateFrontdoorTf(baseConfig);
      expect(result).toContain(
        'origin_host_header             = "${azurerm_linux_web_app.kong.default_hostname}"',
      );
    });

    it('should enable certificate name check on API origin', () => {
      const result = generateFrontdoorTf(baseConfig);
      const apiOriginBlock = result.slice(
        result.indexOf('resource "azurerm_cdn_frontdoor_origin" "api"'),
        result.indexOf('resource "azurerm_cdn_frontdoor_route"'),
      );
      expect(apiOriginBlock).toContain('certificate_name_check_enabled = true');
    });

    it('should create nextjs origin when Next.js services exist', () => {
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
      const result = generateFrontdoorTf(config);
      expect(result).toContain(
        'resource "azurerm_cdn_frontdoor_origin" "nextjs_frontend"',
      );
      expect(result).toContain(
        'host_name                      = "${azurerm_linux_web_app.nextjs_frontend.default_hostname}"',
      );
    });

    it('should not create nextjs origin when no Next.js services', () => {
      const result = generateFrontdoorTf(baseConfig);
      expect(result).not.toContain(
        'resource "azurerm_cdn_frontdoor_origin" "nextjs_frontend"',
      );
    });

    it('should create SPA origins pointing to storage account', () => {
      const config: AzureInfraConfig = {
        ...baseConfig,
        spas: {
          'react-app': { domain: '' },
        },
      };
      const result = generateFrontdoorTf(config);
      expect(result).toContain(
        'resource "azurerm_cdn_frontdoor_origin" "spa_react_app"',
      );
      expect(result).toContain(
        'host_name                      = azurerm_storage_account.spa_react_app.primary_web_host',
      );
    });
  });

  describe('Routes', () => {
    it('should create API route', () => {
      const result = generateFrontdoorTf(baseConfig);
      expect(result).toContain('resource "azurerm_cdn_frontdoor_route" "api"');
    });

    it('should link API route to API endpoint and origin group', () => {
      const result = generateFrontdoorTf(baseConfig);
      expect(result).toContain(
        'cdn_frontdoor_endpoint_id     = azurerm_cdn_frontdoor_endpoint.api.id',
      );
      expect(result).toContain(
        'cdn_frontdoor_origin_group_id = azurerm_cdn_frontdoor_origin_group.api.id',
      );
      expect(result).toContain(
        'cdn_frontdoor_origin_ids      = [azurerm_cdn_frontdoor_origin.api.id]',
      );
    });

    it('should use HttpsOnly forwarding protocol', () => {
      const result = generateFrontdoorTf(baseConfig);
      expect(result).toContain('forwarding_protocol           = "HttpsOnly"');
    });

    it('should enable HTTPS redirect', () => {
      const result = generateFrontdoorTf(baseConfig);
      expect(result).toContain('https_redirect_enabled        = true');
    });

    it('should create nextjs route when Next.js services exist', () => {
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
      const result = generateFrontdoorTf(config);
      expect(result).toContain(
        'resource "azurerm_cdn_frontdoor_route" "nextjs_frontend"',
      );
    });

    it('should not create nextjs route when no Next.js services', () => {
      const result = generateFrontdoorTf(baseConfig);
      expect(result).not.toContain(
        'resource "azurerm_cdn_frontdoor_route" "nextjs_frontend"',
      );
    });

    it('should create SPA routes', () => {
      const config: AzureInfraConfig = {
        ...baseConfig,
        spas: {
          'react-app': { domain: '' },
        },
      };
      const result = generateFrontdoorTf(config);
      expect(result).toContain(
        'resource "azurerm_cdn_frontdoor_route" "spa_react_app"',
      );
    });

    it('should not include custom domain IDs when baseDomain is empty', () => {
      const result = generateFrontdoorTf(baseConfig);
      expect(result).not.toContain('cdn_frontdoor_custom_domain_ids');
    });

    it('should include custom domain IDs on API route when baseDomain is set', () => {
      const config: AzureInfraConfig = {
        ...baseConfig,
        baseDomain: 'example.com',
      };
      const result = generateFrontdoorTf(config);
      expect(result).toContain(
        'cdn_frontdoor_custom_domain_ids = [azurerm_cdn_frontdoor_custom_domain.api.id]',
      );
    });

    it('should include custom domain IDs on nextjs route when baseDomain is set', () => {
      const config: AzureInfraConfig = {
        ...baseConfig,
        baseDomain: 'example.com',
        frontends: {
          frontend: {
            domain: 'frontend.example.com',
            cpu: 0.5,
            memory: '1Gi',
            minInstances: 1,
            maxInstances: 5,
          },
        },
      };
      const result = generateFrontdoorTf(config);
      expect(result).toContain(
        'cdn_frontdoor_custom_domain_ids = [azurerm_cdn_frontdoor_custom_domain.nextjs_frontend.id]',
      );
    });

    it('should include custom domain IDs on SPA route when baseDomain is set', () => {
      const config: AzureInfraConfig = {
        ...baseConfig,
        baseDomain: 'example.com',
        spas: {
          'react-app': { domain: 'react-app.example.com' },
        },
      };
      const result = generateFrontdoorTf(config);
      expect(result).toContain(
        'cdn_frontdoor_custom_domain_ids = [azurerm_cdn_frontdoor_custom_domain.spa_react_app.id]',
      );
    });
  });

  describe('noIndex rule set', () => {
    it('should not include rule set when noIndex is false', () => {
      const result = generateFrontdoorTf(baseConfig);
      expect(result).not.toContain('azurerm_cdn_frontdoor_rule_set');
      expect(result).not.toContain('azurerm_cdn_frontdoor_rule');
      expect(result).not.toContain('X-Robots-Tag');
    });

    it('should include rule set when noIndex is true', () => {
      const result = generateFrontdoorTf({ ...baseConfig, noIndex: true });
      expect(result).toContain(
        'resource "azurerm_cdn_frontdoor_rule_set" "headers"',
      );
      expect(result).toContain(
        'resource "azurerm_cdn_frontdoor_rule" "noindex"',
      );
    });

    it('should add X-Robots-Tag header action', () => {
      const result = generateFrontdoorTf({ ...baseConfig, noIndex: true });
      expect(result).toContain('header_name   = "X-Robots-Tag"');
      expect(result).toContain('value         = "noindex, nofollow"');
    });

    it('should add rule set IDs to API route when noIndex is true', () => {
      const result = generateFrontdoorTf({ ...baseConfig, noIndex: true });
      const apiRouteBlock = result.slice(
        result.indexOf('resource "azurerm_cdn_frontdoor_route" "api"'),
      );
      expect(apiRouteBlock).toContain(
        'cdn_frontdoor_rule_set_ids    = [azurerm_cdn_frontdoor_rule_set.headers.id]',
      );
    });

    it('should add rule set IDs to nextjs route when noIndex is true', () => {
      const config: AzureInfraConfig = {
        ...baseConfig,
        noIndex: true,
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
      const result = generateFrontdoorTf(config);
      const nextjsRouteBlock = result.slice(
        result.indexOf(
          'resource "azurerm_cdn_frontdoor_route" "nextjs_frontend"',
        ),
      );
      expect(nextjsRouteBlock).toContain(
        'cdn_frontdoor_rule_set_ids    = [azurerm_cdn_frontdoor_rule_set.headers.id]',
      );
    });

    it('should add rule set IDs to SPA routes when noIndex is true', () => {
      const config: AzureInfraConfig = {
        ...baseConfig,
        noIndex: true,
        spas: {
          'react-app': { domain: '' },
        },
      };
      const result = generateFrontdoorTf(config);
      const spaRouteBlock = result.slice(
        result.indexOf(
          'resource "azurerm_cdn_frontdoor_route" "spa_react_app"',
        ),
      );
      expect(spaRouteBlock).toContain(
        'cdn_frontdoor_rule_set_ids    = [azurerm_cdn_frontdoor_rule_set.headers.id]',
      );
    });

    it('should not add rule set IDs to routes when noIndex is false', () => {
      const result = generateFrontdoorTf(baseConfig);
      expect(result).not.toContain('cdn_frontdoor_rule_set_ids');
    });
  });

  describe('skipCustomDomainAssociations (two-phase deploy)', () => {
    it('should not include custom domain IDs on API route when flag is set', () => {
      const config: AzureInfraConfig = {
        ...baseConfig,
        baseDomain: 'example.com',
        skipCustomDomainAssociations: true,
      };
      const result = generateFrontdoorTf(config);
      const apiRouteBlock = result.slice(
        result.indexOf('resource "azurerm_cdn_frontdoor_route" "api"'),
      );
      expect(apiRouteBlock).not.toContain('cdn_frontdoor_custom_domain_ids');
    });

    it('should not include custom domain IDs on nextjs route when flag is set', () => {
      const config: AzureInfraConfig = {
        ...baseConfig,
        baseDomain: 'example.com',
        skipCustomDomainAssociations: true,
        frontends: {
          frontend: {
            domain: 'frontend.example.com',
            cpu: 0.5,
            memory: '1Gi',
            minInstances: 1,
            maxInstances: 5,
          },
        },
      };
      const result = generateFrontdoorTf(config);
      expect(result).not.toContain('cdn_frontdoor_custom_domain_ids');
    });

    it('should not include custom domain IDs on SPA route when flag is set', () => {
      const config: AzureInfraConfig = {
        ...baseConfig,
        baseDomain: 'example.com',
        skipCustomDomainAssociations: true,
        spas: {
          'react-app': { domain: 'react-app.example.com' },
        },
      };
      const result = generateFrontdoorTf(config);
      expect(result).not.toContain('cdn_frontdoor_custom_domain_ids');
    });

    it('should NOT include custom domains in security policy when flag is set', () => {
      const config: AzureInfraConfig = {
        ...baseConfig,
        baseDomain: 'example.com',
        skipCustomDomainAssociations: true,
      };
      const result = generateFrontdoorTf(config);
      const securityBlock = result.slice(
        result.indexOf('resource "azurerm_cdn_frontdoor_security_policy"'),
        result.indexOf(
          '# =============================================================================\n# Endpoints',
        ),
      );
      expect(securityBlock).not.toContain(
        'azurerm_cdn_frontdoor_custom_domain',
      );
    });
  });

  describe('header comment', () => {
    it('should include generation comment', () => {
      const result = generateFrontdoorTf(baseConfig);
      expect(result).toContain('Generated by: npx tsdevstack infra:generate');
    });
  });

  describe('Front Door Premium tier', () => {
    it('should use Standard SKU when frontdoorPremium is false', () => {
      const result = generateFrontdoorTf(baseConfig);
      expect(result).toContain(
        'sku_name            = "Standard_AzureFrontDoor"',
      );
      expect(result).not.toContain('Premium_AzureFrontDoor');
    });

    it('should use Premium SKU when frontdoorPremium is true', () => {
      const result = generateFrontdoorTf({
        ...baseConfig,
        frontdoorPremium: true,
      });
      expect(result).toContain(
        'sku_name            = "Premium_AzureFrontDoor"',
      );
      expect(result).not.toContain('Standard_AzureFrontDoor');
    });

    it('should add private_link block on API origin when premium', () => {
      const result = generateFrontdoorTf({
        ...baseConfig,
        frontdoorPremium: true,
      });
      const apiOriginBlock = result.slice(
        result.indexOf('resource "azurerm_cdn_frontdoor_origin" "api"'),
        result.indexOf(
          '# =',
          result.indexOf('resource "azurerm_cdn_frontdoor_origin" "api"') + 1,
        ),
      );
      expect(apiOriginBlock).toContain('private_link {');
      expect(apiOriginBlock).toContain('target_type            = "sites"');
      expect(apiOriginBlock).toContain(
        'private_link_target_id = azurerm_linux_web_app.kong.id',
      );
    });

    it('should not add private_link block on API origin when standard', () => {
      const result = generateFrontdoorTf(baseConfig);
      expect(result).not.toContain('private_link {');
    });

    it('should add private_link block on nextjs origin when premium with Next.js', () => {
      const result = generateFrontdoorTf({
        ...baseConfig,
        frontdoorPremium: true,
        frontends: {
          frontend: {
            domain: '',
            cpu: 0.5,
            memory: '1Gi',
            minInstances: 1,
            maxInstances: 5,
          },
        },
      });
      const nextjsOriginBlock = result.slice(
        result.indexOf(
          'resource "azurerm_cdn_frontdoor_origin" "nextjs_frontend"',
        ),
        result.indexOf(
          'resource "azurerm_cdn_frontdoor_route" "nextjs_frontend"',
        ),
      );
      expect(nextjsOriginBlock).toContain('private_link {');
      expect(nextjsOriginBlock).toContain(
        'private_link_target_id = azurerm_linux_web_app.nextjs_frontend.id',
      );
    });

    it('should add private_link block on each nextjs origin when premium with multiple services', () => {
      const result = generateFrontdoorTf({
        ...baseConfig,
        frontdoorPremium: true,
        frontends: {
          frontend: {
            domain: '',
            cpu: 0.5,
            memory: '1Gi',
            minInstances: 1,
            maxInstances: 5,
          },
          dashboard: {
            domain: '',
            cpu: 0.5,
            memory: '1Gi',
            minInstances: 0,
            maxInstances: 3,
          },
        },
      });

      const frontendOriginBlock = result.slice(
        result.indexOf(
          'resource "azurerm_cdn_frontdoor_origin" "nextjs_frontend"',
        ),
        result.indexOf(
          'resource "azurerm_cdn_frontdoor_route" "nextjs_frontend"',
        ),
      );
      expect(frontendOriginBlock).toContain('private_link {');
      expect(frontendOriginBlock).toContain(
        'private_link_target_id = azurerm_linux_web_app.nextjs_frontend.id',
      );

      const dashboardOriginBlock = result.slice(
        result.indexOf(
          'resource "azurerm_cdn_frontdoor_origin" "nextjs_dashboard"',
        ),
        result.indexOf(
          'resource "azurerm_cdn_frontdoor_route" "nextjs_dashboard"',
        ),
      );
      expect(dashboardOriginBlock).toContain('private_link {');
      expect(dashboardOriginBlock).toContain(
        'private_link_target_id = azurerm_linux_web_app.nextjs_dashboard.id',
      );
    });

    it('should include Premium in header comment when premium', () => {
      const result = generateFrontdoorTf({
        ...baseConfig,
        frontdoorPremium: true,
      });
      expect(result).toContain('Premium Tier');
    });

    it('should include Standard in header comment when standard', () => {
      const result = generateFrontdoorTf(baseConfig);
      expect(result).toContain('Standard Tier');
    });
  });
});
