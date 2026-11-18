import { describe, it, expect } from '@rstest/core';
import { generateTracingTf } from './generate-tracing-tf';
import type { AzureInfraConfig } from '../../types/config.ts';

const baseConfig: AzureInfraConfig = {
  provider: 'azure',
  projectName: 'myproject',
  environment: 'dev',
  subscriptionId: 'test-sub-id',
  location: 'eastus',
  storageAccountName: 'myprojectdevtfstate',
  naming: 'legacy',
  keyVaultName: 'myproject-dev-kv',
  serviceKeyVaults: {},
  dbJobsKeyVault: 'test-dev-dbjobs',
  databaseServiceKeyVaults: {},
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
};

const nextjsApp = {
  domain: '',
  cpu: 1,
  memory: '1Gi',
  minInstances: 1,
  maxInstances: 2,
};

describe('generateTracingTf', () => {
  describe('Application Insights', () => {
    it('should sit on the environment workspace with local auth off', () => {
      const tf = generateTracingTf(baseConfig);

      expect(tf).toContain('resource "azurerm_application_insights" "main"');
      expect(tf).toContain(
        'workspace_id        = azurerm_log_analytics_workspace.main.id',
      );
      expect(tf).toContain('local_authentication_enabled = false');
    });
  });

  describe('Data collection endpoint and rule', () => {
    it('should create the endpoint', () => {
      const tf = generateTracingTf(baseConfig);

      expect(tf).toContain(
        'resource "azurerm_monitor_data_collection_endpoint" "traces"',
      );
    });

    it('should create the rule through azapi with the OTel trace streams into the workspace', () => {
      const tf = generateTracingTf(baseConfig);

      expect(tf).toContain(
        'type      = "Microsoft.Insights/dataCollectionRules@2024-03-11"',
      );
      expect(tf).toContain('directDataSources = {');
      expect(tf).toContain(
        '"Microsoft-OTel-Traces-Spans", "Microsoft-OTel-Traces-Events", "Microsoft-OTel-Traces-Resources"',
      );
      expect(tf).toContain(
        'workspaceResourceId = azurerm_log_analytics_workspace.main.id',
      );
      expect(tf).toContain('resourceId = azurerm_application_insights.main.id');
      expect(tf).toContain(
        'response_export_values = ["properties.immutableId"]',
      );
    });

    it('should use the Application Insights reference in the direct and the agent trace source', () => {
      const tf = generateTracingTf(baseConfig);

      expect(tf).toContain('name                           = "otel-traces"');
      expect(tf).toContain('dataSources = {');
      expect(tf).toContain(
        'name                           = "otel-traces-agent"',
      );
      expect(
        tf.split('enrichWithReference            = "appinsights"'),
      ).toHaveLength(3);
    });

    it("should build the apps' OTLP traces URL from the endpoint and the rule", () => {
      const tf = generateTracingTf(baseConfig);

      expect(tf).toContain(
        'otlp_traces_url = "${azurerm_monitor_data_collection_endpoint.traces.logs_ingestion_endpoint}/datacollectionRules/${azapi_resource.traces_rule.output.properties.immutableId}/streams/Microsoft-OTLP-Traces/otlp/v1/traces"',
      );
    });
  });

  describe('Publisher role on the rule', () => {
    it("should give it to each backend service's identity and to Kong", () => {
      const tf = generateTracingTf(baseConfig);

      expect(tf).toContain(
        'resource "azurerm_role_assignment" "traces_services"',
      );
      expect(tf).toContain('for_each = var.service_key_vaults');
      expect(tf).toContain(
        'principal_id                     = azurerm_user_assigned_identity.service_secrets[each.key].principal_id',
      );
      expect(tf).toContain('resource "azurerm_role_assignment" "traces_kong"');
      expect(tf).toContain(
        'role_definition_name             = "Monitoring Metrics Publisher"',
      );
    });

    it('should give it to every Next.js app', () => {
      const tf = generateTracingTf({
        ...baseConfig,
        frontends: {
          frontend: nextjsApp,
          'admin-web': nextjsApp,
        },
      });

      expect(tf).toContain(
        'resource "azurerm_role_assignment" "traces_nextjs_frontend"',
      );
      expect(tf).toContain(
        'azurerm_linux_web_app.nextjs_admin_web.identity[0].principal_id',
      );
    });

    it('should give it to no Next.js app when there is none', () => {
      expect(generateTracingTf(baseConfig)).not.toContain('traces_nextjs_');
    });
  });
});
