/**
 * Build the email of Cloud Scheduler's service account
 */

/**
 * The account Cloud Scheduler calls the triggers' services and starts the
 * cron jobs' Cloud Run Jobs with: `{project}-scheduler` in the GCP project
 * (google_service_account.scheduler in cloud-scheduler.tf)
 *
 * @param projectName - Project name from config.json
 * @param projectId - The environment's GCP project ID
 * @returns The account's email
 */
export function buildGcpSchedulerAccountEmail(
  projectName: string,
  projectId: string,
): string {
  return `${projectName}-scheduler@${projectId}.iam.gserviceaccount.com`;
}
