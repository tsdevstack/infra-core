/**
 * Generate dashboard.tf: one Azure Monitor workbook per environment
 *
 * Platform metrics (free): the Container Apps of the NestJS services and
 * workers, Kong's and the Next.js apps' App Services and plans, Postgres
 * (with its enhanced metrics), Redis, Front Door and its WAF. Errors come
 * from the services' JSON log lines in the Log Analytics workspace (KQL,
 * charged as workspace queries). The CLI creates the Container Apps, so
 * their IDs are built from their names (<project>-<service>).
 *
 * Metric IDs use the workbook form "<namespace>--<metric>" (no category),
 * as Microsoft's own App Service and Redis workbooks do.
 */

import { toTerraformId } from '../../utils/terraform/to-terraform-id.ts';

interface AzureDashboardOptions {
  /** NestJS services (requests, CPU, memory) */
  serviceNames: string[];
  /** Workers (CPU, memory; no requests) */
  workerNames: string[];
  /** Next.js apps (App Service web apps) */
  nextjsNames: string[];
  /** Whether the database records per-query statistics (not on Burstable) */
  queryStore: boolean;
}

/** Workbook aggregation codes */
const SUM = 1;
const MAX = 3;
const AVERAGE = 4;

/** What every chart shows by default: the last 24 hours */
const DAY_MS = 24 * 60 * 60 * 1000;

const CONTAINER_APPS = 'microsoft.app/containerapps';
const WEB_APPS = 'microsoft.web/sites';
const APP_SERVICE_PLANS = 'microsoft.web/serverfarms';
const POSTGRES = 'microsoft.dbforpostgresql/flexibleservers';
const REDIS = 'microsoft.cache/redisenterprise';
const FRONT_DOOR = 'microsoft.cdn/profiles';
const WORKSPACE = 'microsoft.operationalinsights/workspaces';

/** A Terraform reference inside the heredoc */
function tf(expression: string): string {
  return '${' + expression + '}';
}

function containerAppId(name: string): string {
  return `${tf('data.azurerm_resource_group.main.id')}/providers/Microsoft.App/containerApps/${tf('var.project_name')}-${name}`;
}

function heading(name: string, text: string): unknown {
  return { type: 1, content: { json: text }, name };
}

function metricChart(
  name: string,
  title: string,
  resourceType: string,
  resourceIds: string[],
  metric: string,
  aggregation: number,
): unknown {
  return {
    type: 10,
    content: {
      chartId: `workbook-${name}`,
      version: 'MetricsItem/2.0',
      size: 0,
      chartType: 2,
      resourceType,
      metricScope: 0,
      resourceIds,
      timeContext: { durationMs: DAY_MS },
      metrics: [
        {
          namespace: resourceType,
          metric: `${resourceType}--${metric}`,
          aggregation,
          splitBy: null,
        },
      ],
      title,
      gridSettings: { rowLimit: 10000 },
    },
    customWidth: '50',
    name,
  };
}

function logQuery(
  name: string,
  title: string,
  query: string,
  visualization: 'timechart' | 'table',
): unknown {
  return {
    type: 3,
    content: {
      version: 'KqlItem/1.0',
      query,
      size: 0,
      title,
      timeContext: { durationMs: DAY_MS },
      queryType: 0,
      resourceType: WORKSPACE,
      crossComponentResources: [tf('azurerm_log_analytics_workspace.main.id')],
      visualization,
    },
    customWidth: visualization === 'table' ? '100' : '50',
    name,
  };
}

/** Lines our services and cron jobs log at error or fatal (pino's level labels); a cron job's lines carry its JobName */
const ERROR_LINES =
  'ContainerAppConsoleLogs | where tostring(parse_json(Log).level) in ("error", "fatal")';

export function generateDashboardTf(options: AzureDashboardOptions): string {
  const serviceIds = options.serviceNames.map(containerAppId);
  const backendIds = [...options.serviceNames, ...options.workerNames].map(
    containerAppId,
  );
  const kong = tf('azurerm_linux_web_app.kong.id');
  const webAppIds = [
    kong,
    ...options.nextjsNames.map((name) =>
      tf(`azurerm_linux_web_app.nextjs_${toTerraformId(name)}.id`),
    ),
  ];
  const planIds = [
    tf('azurerm_service_plan.kong.id'),
    ...(options.nextjsNames.length > 0
      ? [tf('azurerm_service_plan.nextjs.id')]
      : []),
  ];
  const postgres = [tf('azurerm_postgresql_flexible_server.main.id')];
  const redis = [tf('azurerm_managed_redis.main.id')];
  const frontDoor = [tf('azurerm_cdn_frontdoor_profile.main.id')];

  const items: unknown[] = [
    heading('services', '## Services and workers (Container Apps)'),
    ...(backendIds.length > 0
      ? [
          metricChart(
            'backend-cpu',
            'CPU (% of the limit)',
            CONTAINER_APPS,
            backendIds,
            'CpuPercentage',
            AVERAGE,
          ),
          metricChart(
            'backend-memory',
            'Memory (% of the limit)',
            CONTAINER_APPS,
            backendIds,
            'MemoryPercentage',
            AVERAGE,
          ),
          metricChart(
            'backend-replicas',
            'Replicas',
            CONTAINER_APPS,
            backendIds,
            'Replicas',
            MAX,
          ),
          metricChart(
            'backend-restarts',
            'Restarts',
            CONTAINER_APPS,
            backendIds,
            'RestartCount',
            MAX,
          ),
        ]
      : []),
    ...(serviceIds.length > 0
      ? [
          metricChart(
            'service-requests',
            'Requests',
            CONTAINER_APPS,
            serviceIds,
            'Requests',
            SUM,
          ),
          metricChart(
            'service-latency',
            'Response time (ms)',
            CONTAINER_APPS,
            serviceIds,
            'ResponseTime',
            AVERAGE,
          ),
        ]
      : []),
    logQuery(
      'service-errors',
      'Error log lines',
      `${ERROR_LINES} | summarize Errors = count() by bin(TimeGenerated, 5m), App = coalesce(ContainerAppName, JobName) | render timechart`,
      'timechart',
    ),
    logQuery(
      'service-error-lines',
      'Latest error log lines',
      `${ERROR_LINES} | project TimeGenerated, App = coalesce(ContainerAppName, JobName), Message = tostring(parse_json(Log).msg), Log | order by TimeGenerated desc | take 50`,
      'table',
    ),

    heading('gateway', '## Kong and Next.js (App Service)'),
    metricChart(
      'web-requests',
      'Requests',
      WEB_APPS,
      webAppIds,
      'Requests',
      SUM,
    ),
    metricChart(
      'web-5xx',
      'Server errors (5xx)',
      WEB_APPS,
      webAppIds,
      'Http5xx',
      SUM,
    ),
    metricChart(
      'web-latency',
      'Response time (s)',
      WEB_APPS,
      webAppIds,
      'HttpResponseTime',
      AVERAGE,
    ),
    metricChart(
      'web-memory',
      'Memory working set',
      WEB_APPS,
      webAppIds,
      'MemoryWorkingSet',
      AVERAGE,
    ),
    metricChart(
      'plan-cpu',
      'Plan CPU (%)',
      APP_SERVICE_PLANS,
      planIds,
      'CpuPercentage',
      AVERAGE,
    ),
    metricChart(
      'plan-memory',
      'Plan memory (%)',
      APP_SERVICE_PLANS,
      planIds,
      'MemoryPercentage',
      AVERAGE,
    ),

    heading(
      'database',
      options.queryStore
        ? "## Database (PostgreSQL)\nPer-query statistics: the server's Query Performance Insight (Query Store is on)."
        : '## Database (PostgreSQL)\nPer-query statistics (Query Store) are off: Microsoft advises against them on Burstable tiers. They turn on with a General Purpose or Memory Optimized tier.',
    ),
    metricChart(
      'db-cpu',
      'CPU (%)',
      POSTGRES,
      postgres,
      'cpu_percent',
      AVERAGE,
    ),
    metricChart(
      'db-memory',
      'Memory (%)',
      POSTGRES,
      postgres,
      'memory_percent',
      AVERAGE,
    ),
    metricChart(
      'db-connections',
      'Active connections',
      POSTGRES,
      postgres,
      'active_connections',
      MAX,
    ),
    metricChart(
      'db-storage',
      'Storage (%)',
      POSTGRES,
      postgres,
      'storage_percent',
      MAX,
    ),
    metricChart(
      'db-transactions',
      'Transactions',
      POSTGRES,
      postgres,
      'xact_total',
      SUM,
    ),
    metricChart(
      'db-deadlocks',
      'Deadlocks',
      POSTGRES,
      postgres,
      'deadlocks',
      SUM,
    ),

    heading('redis', '## Redis'),
    metricChart(
      'redis-memory',
      'Used memory (%)',
      REDIS,
      redis,
      'usedmemorypercentage',
      MAX,
    ),
    metricChart(
      'redis-load',
      'Server load (%)',
      REDIS,
      redis,
      'serverLoad',
      MAX,
    ),
    metricChart(
      'redis-clients',
      'Connected clients',
      REDIS,
      redis,
      'connectedclients',
      MAX,
    ),
    metricChart(
      'redis-operations',
      'Operations per second',
      REDIS,
      redis,
      'operationsPerSecond',
      MAX,
    ),

    heading('edge', '## Front Door and WAF'),
    metricChart(
      'edge-requests',
      'Requests',
      FRONT_DOOR,
      frontDoor,
      'RequestCount',
      SUM,
    ),
    metricChart(
      'edge-5xx',
      'Server errors (% 5xx)',
      FRONT_DOOR,
      frontDoor,
      'Percentage5XX',
      AVERAGE,
    ),
    metricChart(
      'edge-latency',
      'Total latency (ms)',
      FRONT_DOOR,
      frontDoor,
      'TotalLatency',
      AVERAGE,
    ),
    metricChart(
      'edge-waf',
      'Requests the WAF evaluated',
      FRONT_DOOR,
      frontDoor,
      'WebApplicationFirewallRequestCount',
      SUM,
    ),
  ];

  const workbook = {
    version: 'Notebook/1.0',
    items,
    fallbackResourceIds: [tf('lower(data.azurerm_resource_group.main.id)')],
    $schema:
      'https://github.com/Microsoft/Application-Insights-Workbooks/blob/master/schema/workbook.json',
  };

  return `# Dashboard: an Azure Monitor workbook for this environment
# Generated by: npx tsdevstack infra:generate
#
# Listed under the resource group's workbooks; infra:deploy prints its link.

resource "azurerm_application_insights_workbook" "dashboard" {
  # A workbook's name is a GUID; this one stays the same per environment
  name                = uuidv5("url", "https://tsdevstack.dev/\${var.project_name}/\${var.environment}/dashboard")
  resource_group_name = data.azurerm_resource_group.main.name
  location            = data.azurerm_resource_group.main.location
  display_name        = "\${var.project_name} \${var.environment}"
  source_id           = lower(data.azurerm_resource_group.main.id)
  category            = "workbook"
  tags                = local.tags

  data_json = <<-WORKBOOK
${JSON.stringify(workbook, null, 2)}
WORKBOOK
}

output "dashboard_id" {
  description = "The environment's workbook (infra:deploy prints its link)"
  value       = azurerm_application_insights_workbook.dashboard.id
}
`;
}
