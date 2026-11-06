/**
 * Generate dashboard.tf: one Cloud Monitoring dashboard per environment
 *
 * Every chart reads the whole project (one project per environment), so a
 * new service shows up without regenerating. Free: Cloud Monitoring
 * dashboards and Google's own metrics cost nothing.
 */

interface GcpDashboardOptions {
  /** Environment name, in the dashboard's title */
  environment: string;
  /** The environment has the load balancer (and Cloud Armor) */
  hasLoadBalancer: boolean;
}

interface Tile {
  xPos: number;
  yPos: number;
  width: number;
  height: number;
  widget: Record<string, unknown>;
}

const HALF = 24;
const CHART_HEIGHT = 16;

function chart(
  title: string,
  filter: string,
  aggregation: Record<string, unknown>,
  yLabel: string,
): Record<string, unknown> {
  return {
    title,
    xyChart: {
      dataSets: [
        {
          timeSeriesQuery: {
            timeSeriesFilter: { filter, aggregation },
          },
          plotType: 'LINE',
        },
      ],
      yAxis: { label: yLabel, scale: 'LINEAR' },
    },
  };
}

const byService = ['resource.label."service_name"'];

export function generateDashboardTf(options: GcpDashboardOptions): string {
  const run = 'resource.type="cloud_run_revision"';
  const widgets: Array<Record<string, unknown>> = [
    chart(
      'Requests per service',
      `metric.type="run.googleapis.com/request_count" ${run}`,
      {
        alignmentPeriod: '60s',
        perSeriesAligner: 'ALIGN_RATE',
        crossSeriesReducer: 'REDUCE_SUM',
        groupByFields: byService,
      },
      'requests/s',
    ),
    chart(
      'Server errors (5xx) per service',
      `metric.type="run.googleapis.com/request_count" ${run} metric.label."response_code_class"="5xx"`,
      {
        alignmentPeriod: '60s',
        perSeriesAligner: 'ALIGN_RATE',
        crossSeriesReducer: 'REDUCE_SUM',
        groupByFields: byService,
      },
      'errors/s',
    ),
    chart(
      'Latency per service (95th percentile)',
      `metric.type="run.googleapis.com/request_latencies" ${run}`,
      {
        alignmentPeriod: '60s',
        perSeriesAligner: 'ALIGN_DELTA',
        crossSeriesReducer: 'REDUCE_PERCENTILE_95',
        groupByFields: byService,
      },
      'ms',
    ),
    chart(
      'Instances per service',
      `metric.type="run.googleapis.com/container/instance_count" ${run}`,
      {
        alignmentPeriod: '60s',
        perSeriesAligner: 'ALIGN_MAX',
        crossSeriesReducer: 'REDUCE_SUM',
        groupByFields: byService,
      },
      'instances',
    ),
    chart(
      'CPU per service (95th percentile)',
      `metric.type="run.googleapis.com/container/cpu/utilizations" ${run}`,
      {
        alignmentPeriod: '60s',
        perSeriesAligner: 'ALIGN_DELTA',
        crossSeriesReducer: 'REDUCE_PERCENTILE_95',
        groupByFields: byService,
      },
      'utilization',
    ),
    chart(
      'Memory per service (95th percentile)',
      `metric.type="run.googleapis.com/container/memory/utilizations" ${run}`,
      {
        alignmentPeriod: '60s',
        perSeriesAligner: 'ALIGN_DELTA',
        crossSeriesReducer: 'REDUCE_PERCENTILE_95',
        groupByFields: byService,
      },
      'utilization',
    ),
    chart(
      'Database CPU',
      'metric.type="cloudsql.googleapis.com/database/cpu/utilization" resource.type="cloudsql_database"',
      { alignmentPeriod: '60s', perSeriesAligner: 'ALIGN_MEAN' },
      'utilization',
    ),
    // memory/utilization reads a flat 1 on small instances; the components
    // (Usage, Cache, Free, in percent of the instance's memory) show the split
    chart(
      'Database memory',
      'metric.type="cloudsql.googleapis.com/database/memory/components" resource.type="cloudsql_database"',
      {
        alignmentPeriod: '60s',
        perSeriesAligner: 'ALIGN_MEAN',
        crossSeriesReducer: 'REDUCE_MEAN',
        groupByFields: ['metric.label."component"'],
      },
      '% of memory',
    ),
    chart(
      'Database connections',
      'metric.type="cloudsql.googleapis.com/database/postgresql/num_backends" resource.type="cloudsql_database"',
      {
        alignmentPeriod: '60s',
        perSeriesAligner: 'ALIGN_MEAN',
        crossSeriesReducer: 'REDUCE_SUM',
      },
      'connections',
    ),
    chart(
      'Redis memory',
      'metric.type="redis.googleapis.com/stats/memory/usage_ratio" resource.type="redis_instance"',
      { alignmentPeriod: '60s', perSeriesAligner: 'ALIGN_MEAN' },
      'ratio',
    ),
  ];

  if (options.hasLoadBalancer) {
    widgets.push(
      chart(
        'Load balancer requests by response class',
        'metric.type="loadbalancing.googleapis.com/https/request_count" resource.type="https_lb_rule"',
        {
          alignmentPeriod: '60s',
          perSeriesAligner: 'ALIGN_RATE',
          crossSeriesReducer: 'REDUCE_SUM',
          groupByFields: ['metric.label."response_code_class"'],
        },
        'requests/s',
      ),
      chart(
        'Requests blocked by Cloud Armor',
        'metric.type="networksecurity.googleapis.com/https/request_count" resource.type="network_security_policy" metric.label."blocked"="true"',
        {
          alignmentPeriod: '60s',
          perSeriesAligner: 'ALIGN_RATE',
          crossSeriesReducer: 'REDUCE_SUM',
          groupByFields: ['resource.label."policy_name"'],
        },
        'requests/s',
      ),
    );
  }

  const tiles: Tile[] = [
    {
      xPos: 0,
      yPos: 0,
      width: HALF * 2,
      height: 4,
      widget: {
        title: 'More',
        text: {
          content:
            'Traces: **Trace explorer**. Slow queries: **Cloud SQL > Query insights**. Logs from the terminal: `npx tsdevstack infra:logs`.',
          format: 'MARKDOWN',
        },
      },
    },
  ];
  widgets.forEach((widget, index) => {
    tiles.push({
      xPos: (index % 2) * HALF,
      yPos: 4 + Math.floor(index / 2) * CHART_HEIGHT,
      width: HALF,
      height: CHART_HEIGHT,
      widget,
    });
  });
  const lastRow = 4 + Math.ceil(widgets.length / 2) * CHART_HEIGHT;
  tiles.push({
    xPos: 0,
    yPos: lastRow,
    width: HALF * 2,
    height: CHART_HEIGHT,
    widget: {
      title: 'Errors in the logs',
      logsPanel: { filter: 'severity>=ERROR' },
    },
  });

  const body = JSON.stringify(
    {
      displayName: '__DISPLAY_NAME__',
      mosaicLayout: { columns: HALF * 2, tiles },
    },
    null,
    2,
  );

  return `# Cloud Monitoring dashboard
# Generated by: npx tsdevstack infra:generate
#
# One per environment: services (Cloud Run), database, Redis, load balancer
# and Cloud Armor, errors in the logs. infra:deploy prints its link.

resource "google_monitoring_dashboard" "main" {
  dashboard_json = <<-EOT
${body
  .replace(
    '"__DISPLAY_NAME__"',
    `"\${var.project_name} ${options.environment}"`,
  )
  .split('\n')
  .map((line) => `    ${line}`)
  .join('\n')}
  EOT
}

output "dashboard_id" {
  description = "Cloud Monitoring dashboard ID (the last part of its name)"
  value       = element(split("/", google_monitoring_dashboard.main.id), 3)
}
`;
}
