import { describe, it, expect } from '@rstest/core';
import { generateDashboardTf } from './generate-dashboard-tf';

interface Dashboard {
  displayName: string;
  mosaicLayout: {
    columns: number;
    tiles: Array<{
      xPos: number;
      yPos: number;
      width: number;
      height: number;
      widget: { title: string; xyChart?: unknown; logsPanel?: unknown };
    }>;
  };
}

function parse(tf: string): Dashboard {
  const json = tf.split('<<-EOT\n')[1].split('\n  EOT')[0];
  return JSON.parse(json.replace('${var.project_name}', 'shop')) as Dashboard;
}

describe('generateDashboardTf', () => {
  describe('Standard use cases', () => {
    it('should chart services, database, Redis, the load balancer and logged errors', () => {
      const dashboard = parse(
        generateDashboardTf({ environment: 'dev', hasLoadBalancer: true }),
      );

      expect(dashboard.displayName).toBe('shop dev');
      expect(dashboard.mosaicLayout.tiles.map((t) => t.widget.title)).toEqual([
        'More',
        'Requests per service',
        'Server errors (5xx) per service',
        'Latency per service (95th percentile)',
        'Instances per service',
        'CPU per service (95th percentile)',
        'Memory per service (95th percentile)',
        'Database CPU',
        'Database memory',
        'Database connections',
        'Redis memory',
        'Load balancer requests by response class',
        'Requests blocked by Cloud Armor',
        'Errors in the logs',
      ]);
    });

    it("should chart the database's memory split, not the flat utilization", () => {
      const dashboard = parse(
        generateDashboardTf({ environment: 'dev', hasLoadBalancer: true }),
      );
      const memory = dashboard.mosaicLayout.tiles.find(
        (t) => t.widget.title === 'Database memory',
      );

      expect(JSON.stringify(memory?.widget.xyChart)).toContain(
        'cloudsql.googleapis.com/database/memory/components',
      );
      expect(JSON.stringify(memory?.widget.xyChart)).toContain(
        'metric.label.\\"component\\"',
      );
    });

    it('should output the dashboard ID for the link', () => {
      expect(
        generateDashboardTf({ environment: 'dev', hasLoadBalancer: false }),
      ).toContain(
        'value       = element(split("/", google_monitoring_dashboard.main.id), 3)',
      );
    });
  });

  describe('Edge cases', () => {
    it('should leave the load balancer charts out without one', () => {
      const titles = parse(
        generateDashboardTf({ environment: 'prod', hasLoadBalancer: false }),
      ).mosaicLayout.tiles.map((t) => t.widget.title);
      expect(titles).not.toContain('Requests blocked by Cloud Armor');
      expect(titles.at(-1)).toBe('Errors in the logs');
    });

    it('should lay the charts out two per row inside the 48 columns', () => {
      const { columns, tiles } = parse(
        generateDashboardTf({ environment: 'dev', hasLoadBalancer: true }),
      ).mosaicLayout;
      for (const tile of tiles) {
        expect(tile.xPos + tile.width).toBeLessThanOrEqual(columns);
      }
      const positions = tiles.map((t) => `${t.xPos},${t.yPos}`);
      expect(new Set(positions).size).toBe(positions.length);
    });
  });
});
