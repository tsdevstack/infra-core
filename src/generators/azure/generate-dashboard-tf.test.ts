import { describe, it, expect } from '@rstest/core';
import { generateDashboardTf } from './generate-dashboard-tf';

const options = {
  serviceNames: ['auth-service', 'offers-service'],
  workerNames: ['auth-worker'],
  nextjsNames: ['frontend'],
  queryStore: false,
};

/** The workbook JSON inside the heredoc */
function workbookOf(tf: string): {
  items: Array<{
    type: number;
    name: string;
    content: Record<string, unknown>;
  }>;
} {
  const start = tf.indexOf('<<-WORKBOOK\n') + '<<-WORKBOOK\n'.length;
  const end = tf.indexOf('\nWORKBOOK');
  return JSON.parse(tf.slice(start, end));
}

function item(tf: string, name: string): Record<string, unknown> {
  const found = workbookOf(tf).items.find((i) => i.name === name);
  if (!found) throw new Error(`no item ${name}`);
  return found.content;
}

describe('generateDashboardTf', () => {
  describe('Workbook resource', () => {
    it('should create one workbook per environment with a stable GUID name', () => {
      const tf = generateDashboardTf(options);

      expect(tf).toContain(
        'resource "azurerm_application_insights_workbook" "dashboard"',
      );
      expect(tf).toContain(
        'name                = uuidv5("url", "https://tsdevstack.dev/${var.project_name}/${var.environment}/dashboard")',
      );
      expect(tf).toContain(
        'source_id           = lower(data.azurerm_resource_group.main.id)',
      );
    });

    it('should hold valid workbook JSON', () => {
      const workbook = workbookOf(generateDashboardTf(options)) as unknown as {
        version: string;
      };

      expect(workbook.version).toBe('Notebook/1.0');
    });

    it('should output its ID for the link', () => {
      expect(generateDashboardTf(options)).toContain('output "dashboard_id"');
    });
  });

  describe('Services and workers', () => {
    it('should chart CPU for every service and worker, by their Container App IDs', () => {
      const content = item(generateDashboardTf(options), 'backend-cpu');

      expect(content.resourceIds).toEqual([
        '${data.azurerm_resource_group.main.id}/providers/Microsoft.App/containerApps/${var.project_name}-auth-service',
        '${data.azurerm_resource_group.main.id}/providers/Microsoft.App/containerApps/${var.project_name}-offers-service',
        '${data.azurerm_resource_group.main.id}/providers/Microsoft.App/containerApps/${var.project_name}-auth-worker',
      ]);
      expect(content.metrics).toEqual([
        {
          namespace: 'microsoft.app/containerapps',
          metric: 'microsoft.app/containerapps--CpuPercentage',
          aggregation: 4,
          splitBy: null,
        },
      ]);
    });

    it('should chart requests for services only (workers take none)', () => {
      const content = item(generateDashboardTf(options), 'service-requests');

      expect(content.resourceIds).toHaveLength(2);
    });

    it('should query error lines in the workspace', () => {
      const content = item(generateDashboardTf(options), 'service-errors');

      expect(content.version).toBe('KqlItem/1.0');
      expect(content.query).toContain(
        'tostring(parse_json(Log).level) in ("error", "fatal")',
      );
      expect(content.crossComponentResources).toEqual([
        '${azurerm_log_analytics_workspace.main.id}',
      ]);
    });
  });

  describe('Kong and Next.js', () => {
    it("should chart Kong's and each Next.js app's web app", () => {
      const content = item(generateDashboardTf(options), 'web-requests');

      expect(content.resourceIds).toEqual([
        '${azurerm_linux_web_app.kong.id}',
        '${azurerm_linux_web_app.nextjs_frontend.id}',
      ]);
    });

    it('should chart the Next.js plan only when there are Next.js apps', () => {
      const tf = generateDashboardTf({ ...options, nextjsNames: [] });

      expect(item(tf, 'plan-cpu').resourceIds).toEqual([
        '${azurerm_service_plan.kong.id}',
      ]);
    });
  });

  describe('Database', () => {
    it('should chart the enhanced metrics', () => {
      const content = item(generateDashboardTf(options), 'db-transactions');

      expect(content.metrics).toEqual([
        expect.objectContaining({
          metric: 'microsoft.dbforpostgresql/flexibleservers--xact_total',
        }),
      ]);
    });

    it('should say why per-query statistics are off on Burstable', () => {
      const content = item(generateDashboardTf(options), 'database');

      expect(content.json).toContain('Microsoft advises against them');
    });

    it('should point to Query Performance Insight when Query Store is on', () => {
      const content = item(
        generateDashboardTf({ ...options, queryStore: true }),
        'database',
      );

      expect(content.json).toContain('Query Performance Insight');
    });
  });

  describe('Edge cases', () => {
    it('should leave out the Container App charts when there are no backends', () => {
      const tf = generateDashboardTf({
        ...options,
        serviceNames: [],
        workerNames: [],
      });
      const names = workbookOf(tf).items.map((i) => i.name);

      expect(names).not.toContain('backend-cpu');
      expect(names).not.toContain('service-requests');
      expect(names).toContain('web-requests');
    });
  });
});
