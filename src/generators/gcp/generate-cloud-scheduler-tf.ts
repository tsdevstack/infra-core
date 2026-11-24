/**
 * Generate cloud-scheduler.tf with Cloud Scheduler jobs, for both kinds of
 * scheduled job
 *
 * Triggers: scheduled HTTP jobs that call service endpoints with OIDC
 * authentication (with @ApiExcludeController() and SchedulerGuard).
 * Cron jobs: scheduled calls of the Cloud Run Admin API's run method on the
 * job's Cloud Run Job (`{project}-cron-{name}`, created by the deploys),
 * with an OAuth token of the scheduler account, which gets run.invoker on
 * the job when the job is deployed.
 *
 * Uses computed Cloud Run URLs (deterministic pattern) instead of data sources,
 * so this file can be generated without services or jobs existing yet.
 */

import type {
  CronJobConfig,
  NamingScheme,
  TriggerJobConfig,
} from '../../types/index.ts';
import { toTerraformId } from '../../utils/terraform/to-terraform-id.ts';
import { buildGcpCloudRunName } from '../../utils/gcp/build-gcp-cloud-run-name.ts';
import { GCP_SCHEDULER_PROJECT_DESCRIPTION_PREFIX } from '../../constants/resource-naming.ts';
import {
  CRON_JOB_NAME_PREFIX,
  DEFAULT_SCHEDULED_JOB_METHOD,
  DEFAULT_SCHEDULED_JOB_TIMEZONE,
  SCHEDULED_JOB_HTTP_TIMEOUT,
} from '../../constants/index.ts';

/**
 * Generate cloud-scheduler.tf content
 *
 * Creates:
 * - Locals block with computed Cloud Run service URIs
 * - Service account for Cloud Scheduler
 * - Cloud Scheduler job per scheduled task with OIDC authentication
 *
 * IAM bindings (run.invoker) are NOT included here — they require Cloud Run
 * services to exist. Instead, deploy-schedulers sets them imperatively via
 * @google-cloud/run SDK (same pattern as setServiceInvokerPolicy for Kong/services).
 */
export function generateCloudSchedulerTf(
  jobs: TriggerJobConfig[],
  names: { projectName: string; naming: NamingScheme },
  cronJobs: CronJobConfig[] = [],
): string {
  if (jobs.length === 0 && cronJobs.length === 0) {
    return `# No scheduled jobs configured
# Add scheduledJobs in infrastructure.json to generate Cloud Scheduler resources
`;
  }

  // Get unique target services
  const targetServices = Array.from(new Set(jobs.map((j) => j.targetService)));

  // Generate locals block with computed Cloud Run service URIs
  // Cloud Run v2 URLs follow: https://{service}-{project-number}.{region}.run.app
  // Uses data.google_project.current.number (declared in iam.tf)
  const serviceUriEntries = targetServices
    .map((service) => {
      const tfId = toTerraformId(service);
      const cloudRunName = buildGcpCloudRunName(
        names.projectName,
        service,
        names.naming,
      );
      return `    ${tfId} = "https://${cloudRunName}-\${data.google_project.current.number}.\${var.gcp_region}.run.app"`;
    })
    .join('\n');

  const localsBlock =
    targetServices.length > 0
      ? `
locals {
  scheduler_service_uris = {
${serviceUriEntries}
  }
}`
      : '';

  // Generate scheduler jobs
  const schedulerJobs = jobs
    .map((job) => {
      const tfId = toTerraformId(job.name);
      const serviceTfId = toTerraformId(job.targetService);
      const method = job.method ?? DEFAULT_SCHEDULED_JOB_METHOD;
      const timeout = job.httpTimeout ?? SCHEDULED_JOB_HTTP_TIMEOUT.gcp.default;
      const timezone = job.timezone ?? DEFAULT_SCHEDULED_JOB_TIMEZONE;
      // Unique scheme: the project, for discovery (jobs take no labels).
      // Legacy environments get no new line, so their jobs stay unchanged.
      const description =
        names.naming === 'unique'
          ? `\n  description = "${GCP_SCHEDULER_PROJECT_DESCRIPTION_PREFIX}${names.projectName}"`
          : '';

      return `
# Scheduled job: ${job.name}
resource "google_cloud_scheduler_job" "${tfId}" {
  name     = "${buildGcpCloudRunName(names.projectName, job.name, names.naming)}"${description}
  schedule = "${job.schedule}"
  time_zone = "${timezone}"

  http_target {
    uri         = "\${local.scheduler_service_uris.${serviceTfId}}${job.endpoint}"
    http_method = "${method}"

    oidc_token {
      service_account_email = google_service_account.scheduler.email
      audience              = local.scheduler_service_uris.${serviceTfId}
    }
  }

  retry_config {
    retry_count          = 3
    min_backoff_duration = "5s"
    max_backoff_duration = "3600s"
    max_doublings        = 5
  }

  attempt_deadline = "${timeout}s"
}`;
    })
    .join('\n');

  // Cron jobs: the schedule starts the Cloud Run Job through the Admin API.
  // The job itself is the deploys' (SDK); only its name is needed here.
  const cronSchedulerJobs = cronJobs
    .map((job) => {
      const tfId = toTerraformId(job.name);
      const timezone = job.timezone ?? DEFAULT_SCHEDULED_JOB_TIMEZONE;
      const cloudRunJobName = buildGcpCloudRunName(
        names.projectName,
        `${CRON_JOB_NAME_PREFIX}${job.name}`,
        names.naming,
      );
      const description =
        names.naming === 'unique'
          ? `\n  description = "${GCP_SCHEDULER_PROJECT_DESCRIPTION_PREFIX}${names.projectName}"`
          : '';

      return `
# Cron job: ${job.name} (starts the Cloud Run Job ${cloudRunJobName})
resource "google_cloud_scheduler_job" "${tfId}" {
  name     = "${buildGcpCloudRunName(names.projectName, job.name, names.naming)}"${description}
  schedule = "${job.schedule}"
  time_zone = "${timezone}"

  http_target {
    uri         = "https://run.googleapis.com/v2/projects/\${data.google_project.current.project_id}/locations/\${var.gcp_region}/jobs/${cloudRunJobName}:run"
    http_method = "POST"

    oauth_token {
      service_account_email = google_service_account.scheduler.email
    }
  }

  # A failed start is not retried: the next scheduled time is the next attempt
  retry_config {
    retry_count = 0
  }
}`;
    })
    .join('\n');

  return `# Cloud Scheduler Infrastructure
# Generated by: npx tsdevstack infra:generate
#
# Triggers call service endpoints with OIDC authentication.
# Services validate tokens using SchedulerGuard from @tsdevstack/nest-common.
# Cron jobs start their Cloud Run Job through the Cloud Run Admin API (OAuth).
#
# Cloud Run URLs are computed from project number (no dependency on existing services).
# IAM bindings (run.invoker) are set via SDK, not Terraform: on the services by
# infra:deploy and deploy-schedulers, on a cron job's Cloud Run Job when it is deployed.

# ─────────────────────────────────────────
# Computed Service URIs
# ─────────────────────────────────────────
${localsBlock}

# ─────────────────────────────────────────
# Service Account
# ─────────────────────────────────────────

# Service account for Cloud Scheduler
resource "google_service_account" "scheduler" {
  account_id   = "\${var.project_name}-scheduler"
  display_name = "Cloud Scheduler Service Account"
  description  = "Service account for Cloud Scheduler to invoke Cloud Run services and jobs"
}

# ─────────────────────────────────────────
# Scheduled Jobs
# ─────────────────────────────────────────
${schedulerJobs}${cronSchedulerJobs}
`;
}
