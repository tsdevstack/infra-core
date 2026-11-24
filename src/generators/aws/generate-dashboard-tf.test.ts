import { describe, it, expect } from '@rstest/core';
import { generateDashboardTf } from './generate-dashboard-tf';

interface Widget {
  type: string;
  x: number;
  y: number;
  width: number;
  properties: {
    title?: string;
    region?: string;
    query?: string;
    metrics?: unknown[][];
  };
}

function parse(tf: string): Widget[] {
  const json = tf.split('<<-EOT\n')[1].split('\n  EOT')[0];
  return (JSON.parse(json) as { widgets: Widget[] }).widgets;
}

describe('generateDashboardTf', () => {
  describe('Standard use cases', () => {
    it('should chart services, load balancer, database, Redis, WAF and the logs', () => {
      const widgets = parse(
        generateDashboardTf({
          projectName: 'shop',
          backendNames: ['auth-service', 'auth-worker'],
        }),
      );

      expect(widgets.map((w) => w.properties.title)).toEqual([
        undefined,
        'CPU per service (%)',
        'Memory per service (%)',
        'Load balancer: requests and 5xx (Kong, Next.js)',
        'Load balancer: response time (95th percentile, s)',
        'Database CPU (%)',
        'Database connections',
        'Database free memory (bytes)',
        'Redis memory used (%)',
        'Requests blocked by the WAF',
        'Requests and latency per service (from the logs)',
        'Server errors per service (from the logs)',
        'Errors in the logs',
      ]);
    });

    it("should find every service of the cluster with a search, in the environment's region", () => {
      const [, cpu] = parse(
        generateDashboardTf({ projectName: 'shop', backendNames: [] }),
      );
      expect(cpu.properties.region).toBe('${var.aws_region}');
      expect(cpu.properties.metrics).toEqual([
        [
          {
            expression:
              'SEARCH(\'{AWS/ECS,ClusterName,ServiceName} MetricName="CPUUtilization" ClusterName="shop-cluster"\', \'Average\', 300)',
            id: 'e1',
          },
        ],
      ]);
    });

    it("should read the backends' log groups for per-service traffic", () => {
      const widgets = parse(
        generateDashboardTf({
          projectName: 'shop',
          backendNames: ['auth-service', 'auth-worker'],
        }),
      );
      expect(widgets.at(-1)!.properties.query).toBe(
        "SOURCE '/ecs/shop/auth-service' | SOURCE '/ecs/shop/auth-worker' | filter level = 'error' | fields @timestamp, service, msg | sort @timestamp desc | limit 50",
      );
    });
  });

  describe('Cron jobs', () => {
    it("should read the cron jobs' log groups for errors only", () => {
      const widgets = parse(
        generateDashboardTf({
          projectName: 'shop',
          backendNames: ['auth-service'],
          cronJobNames: ['usage-report'],
        }),
      );
      const query = (title: string) =>
        widgets.find((w) => w.properties.title === title)?.properties.query;
      expect(query('Errors in the logs')).toBe(
        "SOURCE '/ecs/shop/auth-service' | SOURCE '/ecs/shop/cron-usage-report' | filter level = 'error' | fields @timestamp, service, msg | sort @timestamp desc | limit 50",
      );
      expect(
        query('Requests and latency per service (from the logs)'),
      ).not.toContain('cron-usage-report');
    });
  });

  describe('Edge cases', () => {
    it("should read the CloudFront WAF's metrics in us-east-1", () => {
      const waf = parse(
        generateDashboardTf({ projectName: 'shop', backendNames: [] }),
      ).find((w) => w.properties.title === 'Requests blocked by the WAF');
      expect(waf?.properties.region).toBe('us-east-1');
    });

    it('should leave the log widgets out without backends', () => {
      const titles = parse(
        generateDashboardTf({ projectName: 'shop', backendNames: [] }),
      ).map((w) => w.properties.title);
      expect(titles).not.toContain('Errors in the logs');
    });

    it('should name the dashboard after the environment and output the name', () => {
      const tf = generateDashboardTf({ projectName: 'shop', backendNames: [] });
      expect(tf).toContain(
        'dashboard_name = "${var.project_name}-${var.environment}"',
      );
      expect(tf).toContain(
        'value       = aws_cloudwatch_dashboard.main.dashboard_name',
      );
    });

    it('should keep every widget inside the 24 columns, no two in one place', () => {
      const widgets = parse(
        generateDashboardTf({ projectName: 'shop', backendNames: ['a'] }),
      );
      for (const widget of widgets) {
        expect(widget.x + widget.width).toBeLessThanOrEqual(24);
      }
      const places = widgets.map((w) => `${w.x},${w.y}`);
      expect(new Set(places).size).toBe(places.length);
    });
  });
});
