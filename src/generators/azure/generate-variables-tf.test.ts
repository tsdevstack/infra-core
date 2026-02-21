import { describe, it, expect } from '@rstest/core';
import { generateVariablesTf } from './generate-variables-tf';
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

describe('generateVariablesTf', () => {
  it('should generate core variables', () => {
    const result = generateVariablesTf(baseConfig);

    expect(result).toContain('variable "project_name"');
    expect(result).toContain('variable "environment"');
    expect(result).toContain('variable "location"');
    expect(result).toContain('variable "subscription_id"');
  });

  it('should generate service image variables for NestJS services (not Kong)', () => {
    const config = {
      ...baseConfig,
      services: {
        'auth-service': {
          cpu: 0.25,
          memory: '0.5Gi',
          minInstances: 0,
          maxInstances: 3,
        },
        'bff-service': {
          cpu: 0.25,
          memory: '0.5Gi',
          minInstances: 0,
          maxInstances: 3,
        },
      },
    };

    const result = generateVariablesTf(config);

    expect(result).toContain('variable "auth_service_image"');
    expect(result).toContain('variable "bff_service_image"');
    // Kong is on App Service now, not in the services map
    expect(result).not.toContain('variable "kong_image"');
  });

  it('should NOT generate database password variables (managed by random_password)', () => {
    const config = {
      ...baseConfig,
      servicesWithDatabase: [
        { name: 'auth-service', hasDatabase: true },
        { name: 'bff-service', hasDatabase: false },
      ],
    };

    const result = generateVariablesTf(config);

    expect(result).not.toContain('variable "db_admin_password"');
    expect(result).not.toContain('variable "db_auth_service_password"');
  });

  it('should generate worker image variables', () => {
    const config = {
      ...baseConfig,
      workers: {
        'email-worker': { cpu: 0.25, memory: '0.5Gi', service: 'auth-service' },
      },
    };

    const result = generateVariablesTf(config);

    expect(result).toContain('variable "email_worker_image"');
  });

  describe('App Service variables', () => {
    it('should generate kong_app_service_sku variable', () => {
      const result = generateVariablesTf(baseConfig);
      expect(result).toContain('variable "kong_app_service_sku"');
    });

    it('should generate nextjs_app_service_sku variable', () => {
      const result = generateVariablesTf(baseConfig);
      expect(result).toContain('variable "nextjs_app_service_sku"');
    });

    it('should default App Service SKUs to B1', () => {
      const result = generateVariablesTf(baseConfig);
      // Extract kong_app_service_sku block
      const kongSkuStart = result.indexOf('variable "kong_app_service_sku"');
      const nextjsSkuStart = result.indexOf(
        'variable "nextjs_app_service_sku"',
      );
      const kongSkuBlock = result.slice(kongSkuStart, nextjsSkuStart);
      expect(kongSkuBlock).toContain('default     = "B1"');

      const nextjsSkuBlock = result.slice(
        nextjsSkuStart,
        result.indexOf('# ===', nextjsSkuStart + 1),
      );
      expect(nextjsSkuBlock).toContain('default     = "B1"');
    });
  });
});
