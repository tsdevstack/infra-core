/**
 * Generate dashboard.tf: one CloudWatch dashboard per environment
 *
 * Free metrics only: AWS/ECS CPU and memory (Container Insights stays off),
 * the ALB, RDS, ElastiCache and WAF. Backends behind Kong have no
 * per-service request metrics on AWS, so requests, latency and errors per
 * service come from Logs Insights over their request log lines (charged per
 * GB scanned, each time the dashboard is viewed). The first three
 * dashboards of an account are free, then $3 per dashboard per month.
 */

interface AwsDashboardOptions {
  projectName: string;
  /** NestJS services and workers: their JSON request and error lines */
  backendNames: string[];
}

interface Widget {
  type: 'metric' | 'log' | 'text';
  x: number;
  y: number;
  width: number;
  height: number;
  properties: Record<string, unknown>;
}

const HALF = 12;
const HEIGHT = 6;

function search(expression: string, stat: string): unknown[][] {
  return [
    [{ expression: `SEARCH('${expression}', '${stat}', 300)`, id: 'e1' }],
  ];
}

function metricWidget(
  title: string,
  metrics: unknown[][],
  options: Record<string, unknown> = {},
): Omit<Widget, 'x' | 'y' | 'width' | 'height'> {
  return {
    type: 'metric',
    properties: {
      title,
      region: '__REGION__',
      view: 'timeSeries',
      period: 300,
      stat: 'Average',
      metrics,
      ...options,
    },
  };
}

function logWidget(
  title: string,
  logGroups: string[],
  query: string,
): Omit<Widget, 'x' | 'y' | 'width' | 'height'> {
  const sources = logGroups.map((group) => `SOURCE '${group}'`).join(' | ');
  return {
    type: 'log',
    properties: {
      title,
      region: '__REGION__',
      view: 'table',
      query: `${sources} | ${query}`,
    },
  };
}

export function generateDashboardTf(options: AwsDashboardOptions): string {
  const cluster = `${options.projectName}-cluster`;
  const alb = '${aws_lb.main.arn_suffix}';
  const db = '${aws_db_instance.main.identifier}';
  const redis =
    '${aws_elasticache_replication_group.main.replication_group_id}-001';
  const logGroups = options.backendNames.map(
    (name) => `/ecs/${options.projectName}/${name}`,
  );

  const widgets: Array<Omit<Widget, 'x' | 'y' | 'width' | 'height'>> = [
    metricWidget(
      'CPU per service (%)',
      search(
        `{AWS/ECS,ClusterName,ServiceName} MetricName="CPUUtilization" ClusterName="${cluster}"`,
        'Average',
      ),
    ),
    metricWidget(
      'Memory per service (%)',
      search(
        `{AWS/ECS,ClusterName,ServiceName} MetricName="MemoryUtilization" ClusterName="${cluster}"`,
        'Average',
      ),
    ),
    metricWidget('Load balancer: requests and 5xx (Kong, Next.js)', [
      [
        'AWS/ApplicationELB',
        'RequestCount',
        'LoadBalancer',
        alb,
        { stat: 'Sum' },
      ],
      [
        'AWS/ApplicationELB',
        'HTTPCode_Target_5XX_Count',
        'LoadBalancer',
        alb,
        { stat: 'Sum' },
      ],
    ]),
    metricWidget(
      'Load balancer: response time (95th percentile, s)',
      [['AWS/ApplicationELB', 'TargetResponseTime', 'LoadBalancer', alb]],
      { stat: 'p95' },
    ),
    metricWidget('Database CPU (%)', [
      ['AWS/RDS', 'CPUUtilization', 'DBInstanceIdentifier', db],
    ]),
    metricWidget('Database connections', [
      ['AWS/RDS', 'DatabaseConnections', 'DBInstanceIdentifier', db],
    ]),
    metricWidget('Database free memory (bytes)', [
      ['AWS/RDS', 'FreeableMemory', 'DBInstanceIdentifier', db],
    ]),
    metricWidget('Redis memory used (%)', [
      [
        'AWS/ElastiCache',
        'DatabaseMemoryUsagePercentage',
        'CacheClusterId',
        redis,
      ],
    ]),
    metricWidget(
      'Requests blocked by the WAF',
      search(
        `{AWS/WAFV2,Rule,WebACL} MetricName="BlockedRequests" WebACL="${options.projectName}-waf"`,
        'Sum',
      ),
      // The CloudFront WAF's metrics live in us-east-1
      { region: 'us-east-1' },
    ),
  ];

  if (logGroups.length > 0) {
    widgets.push(
      logWidget(
        'Requests and latency per service (from the logs)',
        logGroups,
        'filter ispresent(http.statusCode) | stats count(*) as requests, pct(http.duration, 95) as p95_ms by service | sort requests desc',
      ),
      logWidget(
        'Server errors per service (from the logs)',
        logGroups,
        'filter http.statusCode >= 500 | stats count(*) as server_errors by service | sort server_errors desc',
      ),
      logWidget(
        'Errors in the logs',
        logGroups,
        "filter level = 'error' | fields @timestamp, service, msg | sort @timestamp desc | limit 50",
      ),
    );
  }

  const placed: Widget[] = [
    {
      type: 'text',
      x: 0,
      y: 0,
      width: HALF * 2,
      height: 2,
      properties: {
        markdown:
          'Traces: **CloudWatch > Application Signals > Transaction Search**. Slow queries: **CloudWatch > Database Insights**. Logs from the terminal: `npx tsdevstack infra:logs`.',
      },
    },
    ...widgets.map((widget, index) => ({
      ...widget,
      x: (index % 2) * HALF,
      y: 2 + Math.floor(index / 2) * HEIGHT,
      width: HALF,
      height: HEIGHT,
    })),
  ];

  const body = JSON.stringify({ widgets: placed }, null, 2).replaceAll(
    '"__REGION__"',
    '"${var.aws_region}"',
  );

  return `# CloudWatch dashboard
# Generated by: npx tsdevstack infra:generate
#
# One per environment: services (ECS), load balancer, database, Redis, WAF,
# and requests and errors per service from the logs. infra:deploy prints its
# link.

resource "aws_cloudwatch_dashboard" "main" {
  dashboard_name = "\${var.project_name}-\${var.environment}"
  dashboard_body = <<-EOT
${body
  .split('\n')
  .map((line) => `    ${line}`)
  .join('\n')}
  EOT
}

output "dashboard_name" {
  description = "CloudWatch dashboard name"
  value       = aws_cloudwatch_dashboard.main.dashboard_name
}
`;
}
