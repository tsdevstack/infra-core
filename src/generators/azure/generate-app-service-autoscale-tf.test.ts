import { describe, it, expect } from '@rstest/core';
import { generateAppServiceAutoscaleTf } from './generate-app-service-autoscale-tf';
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
    frontends: {
      frontend: {
        domain: '',
        cpu: 1,
        memory: '1Gi',
        minInstances: 1,
        maxInstances: 5,
      },
    },
    scheduledJobs: {},
    storageBuckets: [],
    noIndex: false,
    frontdoorPremium: false,
    kongAppServiceSku: 'S1',
    nextjsAppServiceSku: 'S1',
    kongScaling: { instances: 1, autoscaleMax: null },
    nextjsScaling: { instances: 1, autoscaleMax: null },
    ...overrides,
  };
}

describe('generateAppServiceAutoscaleTf', () => {
  describe('No autoscale', () => {
    it('should return nothing when no plan autoscales', () => {
      expect(generateAppServiceAutoscaleTf(makeConfig())).toBe('');
    });

    it('should ignore the Next.js plan when there is no Next.js app', () => {
      expect(
        generateAppServiceAutoscaleTf(
          makeConfig({
            frontends: {},
            nextjsScaling: { instances: 1, autoscaleMax: 5 },
          }),
        ),
      ).toBe('');
    });
  });

  describe('Autoscale settings', () => {
    it('should create one setting per plan that autoscales', () => {
      const result = generateAppServiceAutoscaleTf(
        makeConfig({
          kongScaling: { instances: 2, autoscaleMax: 6 },
          nextjsScaling: { instances: 1, autoscaleMax: 3 },
        }),
      );
      expect(result).toContain(
        'resource "azurerm_monitor_autoscale_setting" "kong"',
      );
      expect(result).toContain(
        'resource "azurerm_monitor_autoscale_setting" "nextjs"',
      );
      expect(result).toContain(
        'target_resource_id  = azurerm_service_plan.kong.id',
      );
      expect(result).toContain(
        'target_resource_id  = azurerm_service_plan.nextjs.id',
      );
    });

    it('should leave out a plan that does not autoscale', () => {
      const result = generateAppServiceAutoscaleTf(
        makeConfig({ kongScaling: { instances: 1, autoscaleMax: 3 } }),
      );
      expect(result).toContain('"azurerm_monitor_autoscale_setting" "kong"');
      expect(result).not.toContain('"nextjs"');
    });

    it('should scale between the instances and the ceiling, defaulting to the instances', () => {
      const result = generateAppServiceAutoscaleTf(
        makeConfig({ kongScaling: { instances: 2, autoscaleMax: 6 } }),
      );
      expect(result).toContain('minimum = 2');
      expect(result).toContain('maximum = 6');
      expect(result).toContain('default = 2');
    });

    it('should scale out by one above 70% CPU over 5 minutes', () => {
      const result = generateAppServiceAutoscaleTf(
        makeConfig({ kongScaling: { instances: 1, autoscaleMax: 3 } }),
      );
      const scaleOut = result.slice(
        result.indexOf('operator           = "GreaterThan"') - 400,
        result.indexOf('direction = "Increase"') + 120,
      );
      expect(scaleOut).toContain('metric_name        = "CpuPercentage"');
      expect(scaleOut).toContain(
        'metric_resource_id = azurerm_service_plan.kong.id',
      );
      expect(scaleOut).toContain('time_grain         = "PT1M"');
      expect(scaleOut).toContain('time_window        = "PT5M"');
      expect(scaleOut).toContain('threshold          = 70');
      expect(scaleOut).toContain('type      = "ChangeCount"');
      expect(scaleOut).toContain('value     = "1"');
      expect(scaleOut).toContain('cooldown  = "PT5M"');
    });

    it('should scale in by one below 30% CPU over 10 minutes', () => {
      const result = generateAppServiceAutoscaleTf(
        makeConfig({ kongScaling: { instances: 1, autoscaleMax: 3 } }),
      );
      const scaleIn = result.slice(
        result.indexOf('operator           = "LessThan"') - 400,
      );
      expect(scaleIn).toContain('time_window        = "PT10M"');
      expect(scaleIn).toContain('threshold          = 30');
      expect(scaleIn).toContain('direction = "Decrease"');
      expect(scaleIn).toContain('cooldown  = "PT10M"');
    });

    it('should name the setting after the project, environment and plan', () => {
      const result = generateAppServiceAutoscaleTf(
        makeConfig({ kongScaling: { instances: 1, autoscaleMax: 3 } }),
      );
      expect(result).toContain(
        'name                = "${var.project_name}-${var.environment}-kong-autoscale"',
      );
    });
  });
});
