/**
 * A cron job on AWS: an ECS task definition, its log group and an
 * EventBridge schedule (cron-jobs.tf), plus the revisions deploys register
 */

/**
 * Tags of a cron job's task definition (Terraform's revision and every one a
 * deploy registers) and log group: its service and its name. Discovery
 * (remove-service, remove-scheduler) reads them, not infrastructure.json.
 */
export const AWS_CRON_JOB_SERVICE_TAG = 'tsdevstack-cron-service';
export const AWS_CRON_JOB_NAME_TAG = 'tsdevstack-cron-job';

/** The tag every resource of the environment carries (the provider's default_tags, main.tf) */
export const AWS_PROJECT_TAG = 'Project';

/** awslogs stream prefix of the cron job's container: streams are `{prefix}/{container}/{task ID}` */
export const AWS_CRON_JOB_LOG_STREAM_PREFIX = 'ecs';
