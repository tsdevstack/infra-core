/**
 * Generate Terraform IAM Configuration
 *
 * Creates per-service runtime service accounts with scoped secret access.
 * Each service can only access:
 * - {projectName}-shared-* secrets (shared across all services)
 * - {projectName}-{serviceName}-* secrets (service-specific)
 *
 * A service whose name prefix covers another service's secrets (`auth` next
 * to `auth-service`) gets those excluded from its condition.
 *
 * Also creates the Kong Gateway service account. It can read only the
 * secrets Kong reads when it starts (Cloud Run sets them as environment
 * variables; the image never holds them), each by its exact name.
 *
 * The database jobs' service account (db-init) reads the admin password
 * and each database service's DATABASE_URL, and adds DATABASE_URL versions.
 * Each database service's migration account reads only that service's
 * MIGRATION_DATABASE_URL (the owner role's password): the code in a Cloud
 * Run job can use the job's account, so a migration runs with no more than
 * it needs. A service's runtime account never reads its
 * MIGRATION_DATABASE_URL: only migrations change the schema.
 */

import { findSecretScopeOverlaps } from '../../utils/secrets/find-secret-scope-overlaps.ts';

/**
 * Service info for IAM generation
 */
export interface ServiceIamInfo {
  name: string;
}

/**
 * Generate iam.tf with per-service runtime service accounts
 *
 * @param services - Services that get a runtime service account
 * @param kongSecrets - Keys of the shared secrets Kong reads when it starts
 * @param databaseServices - Services with a database (db-init and migrations)
 */
export function generateIamTf(
  services: ServiceIamInfo[],
  kongSecrets: readonly string[] = [],
  databaseServices: readonly string[] = [],
): string {
  // Build the locals block for service list
  const serviceNames = services.map((s) => `"${s.name}"`).join(', ');
  const databaseServiceNames = databaseServices
    .map((name) => `"${name}"`)
    .join(', ');

  // Only projects with overlapping names get the exclusions, so every other
  // project keeps a byte-identical condition (a changed condition replaces
  // the binding, which briefly removes the service's secret access)
  const overlaps = Object.entries(
    findSecretScopeOverlaps(services.map((s) => s.name)),
  );
  const exclusionsLocal =
    overlaps.length === 0
      ? ''
      : `

  # Secrets a service's name prefix also matches (a service "auth" next to
  # "auth-service"): its condition excludes them
  secret_scope_exclusions = tomap({
${overlaps
  .map(
    ([scope, covered]) =>
      `    "${scope}" = [${covered.map((c) => `"${c}"`).join(', ')}]`,
  )
  .join('\n')}
  })`;
  const exclusionsCondition =
    overlaps.length === 0
      ? ''
      : `\${join("", [for other in lookup(local.secret_scope_exclusions, each.key, []) : " && !resource.name.startsWith(\\"projects/\${data.google_project.current.number}/secrets/\${var.project_name}-\${other}-\\")"])}`;

  // Each secret by its exact name: the secret itself and its versions
  const kongCondition = kongSecrets
    .map((key) => {
      const secret = `projects/\${data.google_project.current.number}/secrets/\${var.project_name}-shared-${key}`;
      return `resource.name == \\"${secret}\\" || resource.name.startsWith(\\"${secret}/\\")`;
    })
    .join(' || ');
  const kongSecretsResource =
    kongSecrets.length === 0
      ? ''
      : `
# Kong reads exactly these secrets when it starts (Cloud Run sets them as
# environment variables): ${kongSecrets.join(', ')}
resource "google_project_iam_member" "kong_secrets" {
  project = var.gcp_project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:\${google_service_account.kong.email}"

  condition {
    title       = "kong-runtime-secrets-only"
    description = "Allow Kong to read the secrets it reads at startup only"
    expression  = "${kongCondition}"
  }
}
`;

  // Each secret by its exact name: the secret itself and its versions
  const exactSecrets = (names: string[]): string =>
    names
      .map((name) => {
        const secret = `projects/\${data.google_project.current.number}/secrets/\${var.project_name}-${name}`;
        return `resource.name == \\"${secret}\\" || resource.name.startsWith(\\"${secret}/\\")`;
      })
      .join(' || ');
  const databaseUrls = databaseServices.map((name) => `${name}-DATABASE_URL`);
  // Only while services have databases (an empty condition is invalid)
  const dbJobsWrite =
    databaseServices.length === 0
      ? ''
      : `
# The CLI creates the DATABASE_URL secrets; db-init adds versions
resource "google_project_iam_member" "db_jobs_secrets_write" {
  project = var.gcp_project_id
  role    = "roles/secretmanager.secretVersionAdder"
  member  = "serviceAccount:\${google_service_account.db_jobs.email}"

  condition {
    title       = "database-url-only"
    description = "Each service's DATABASE_URL (the app role)"
    expression  = "${exactSecrets(databaseUrls)}"
  }
}
`;
  // Always there (the Cloud SQL instance always is): remove-service runs
  // db-init after the last database service is gone, to drop its roles
  const dbJobsResources = `
# Database jobs: db-init (sets up each service's owner and app role, writes
# DATABASE_URL; drops the roles of a removed service)
resource "google_service_account" "db_jobs" {
  account_id   = "\${var.project_name}-db-jobs"
  display_name = "Database jobs (db-init)"
  description  = "Runs db-init"
}

resource "google_project_iam_member" "db_jobs_secrets_read" {
  project = var.gcp_project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:\${google_service_account.db_jobs.email}"

  condition {
    title       = "database-secrets-only"
    description = "The database admin password and each service's DATABASE_URL"
    expression  = "${exactSecrets(['db-admin-password', ...databaseUrls])}"
  }
}

${dbJobsWrite}
# Migration jobs: one account per database service, reading only its
# MIGRATION_DATABASE_URL (the owner). The code in a Cloud Run job can use
# the job's account, so a migration never runs as db-jobs.
# Note: account_id max 30 chars; "-mg" is as long as the runtime's "-rt"
resource "google_service_account" "migrate" {
  for_each = toset(local.database_services)

  account_id   = "\${var.project_name}-\${each.key}-mg"
  display_name = "Migrations SA for \${each.key}"
  description  = "Runs the migration jobs of \${each.key}"
}

resource "google_project_iam_member" "migrate_secrets" {
  for_each = toset(local.database_services)

  project = var.gcp_project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:\${google_service_account.migrate[each.key].email}"

  condition {
    title       = "\${each.key}-owner-url-only"
    description = "Allow \${each.key}'s migrations to read its MIGRATION_DATABASE_URL only"
    expression  = "resource.name == \\"projects/\${data.google_project.current.number}/secrets/\${var.project_name}-\${each.key}-MIGRATION_DATABASE_URL\\" || resource.name.startsWith(\\"projects/\${data.google_project.current.number}/secrets/\${var.project_name}-\${each.key}-MIGRATION_DATABASE_URL/\\")"
  }
}
`;

  return `# Per-service runtime service accounts with scoped secret access
# Generated by: npx tsdevstack infra:generate

locals {
  services          = [${serviceNames}]
  database_services = [${databaseServiceNames}]${exclusionsLocal}
}

# Get project number (required for IAM conditions - resource.name uses project number, not ID)
data "google_project" "current" {
  project_id = var.gcp_project_id
}

# Per-service runtime service accounts
# Note: account_id max 30 chars, so we use "-rt" suffix instead of "-runtime"
resource "google_service_account" "runtime" {
  for_each = toset(local.services)

  account_id   = "\${var.project_name}-\${each.key}-rt"
  display_name = "Runtime SA for \${each.key}"
  description  = "Service account used by \${each.key} Cloud Run service"
}

# Kong Gateway service account
# Separate from per-service SAs as Kong is infrastructure, not a microservice
resource "google_service_account" "kong" {
  account_id   = "\${var.project_name}-kong-rt"
  display_name = "Runtime SA for Kong Gateway"
  description  = "Service account used by Kong Gateway Cloud Run service"
}

# Grant Cloud SQL Client role to all runtime SAs
resource "google_project_iam_member" "runtime_cloudsql" {
  for_each = toset(local.services)

  project = var.gcp_project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:\${google_service_account.runtime[each.key].email}"
}

# Traces to Cloud Trace (OTLP to telemetry.googleapis.com): every service,
# worker and frontend, and Kong's collector sidecar
resource "google_project_iam_member" "runtime_traces" {
  for_each = toset(local.services)

  project = var.gcp_project_id
  role    = "roles/telemetry.tracesWriter"
  member  = "serviceAccount:\${google_service_account.runtime[each.key].email}"
}

resource "google_project_iam_member" "kong_traces" {
  project = var.gcp_project_id
  role    = "roles/telemetry.tracesWriter"
  member  = "serviceAccount:\${google_service_account.kong.email}"
}

# Grant Secret Manager access with scoped conditions
# Each service can only access shared secrets and its own service-specific
# secrets, but not its MIGRATION_DATABASE_URL (the owner role's password).
# CEL: && binds tighter than ||, so the exclusions only narrow its own scope.
# Note: resource.name in IAM uses project NUMBER (not ID), so we use data.google_project.current.number
# A changed condition replaces the binding: the new one (new title) is
# created before the old one goes, so the service never loses access.
resource "google_project_iam_member" "runtime_secrets" {
  for_each = toset(local.services)

  project = var.gcp_project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:\${google_service_account.runtime[each.key].email}"

  condition {
    title       = "\${each.key}-secrets-no-owner-url"
    description = "Allow access to shared secrets and \${each.key}-specific secrets only, without its MIGRATION_DATABASE_URL"
    expression  = "resource.name.startsWith(\\"projects/\${data.google_project.current.number}/secrets/\${var.project_name}-shared-\\") || resource.name.startsWith(\\"projects/\${data.google_project.current.number}/secrets/\${var.project_name}-\${each.key}-\\")${exclusionsCondition} && !(resource.name == \\"projects/\${data.google_project.current.number}/secrets/\${var.project_name}-\${each.key}-MIGRATION_DATABASE_URL\\" || resource.name.startsWith(\\"projects/\${data.google_project.current.number}/secrets/\${var.project_name}-\${each.key}-MIGRATION_DATABASE_URL/\\"))"
  }

  lifecycle {
    create_before_destroy = true
  }
}
${dbJobsResources}${kongSecretsResource}`;
}
