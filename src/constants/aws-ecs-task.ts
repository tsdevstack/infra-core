/**
 * One-off ECS tasks (database migrations)
 */

/** Container name in the migration task definition (also the log stream prefix) */
export const ECS_MIGRATION_CONTAINER_NAME = 'migration';

/**
 * Extra polls after ECS reports a task STOPPED without the container's exit
 * code. DescribeTasks can show lastStatus STOPPED before the exit code is
 * recorded; reading it once turned successful migrations into failures.
 */
export const ECS_TASK_EXIT_CODE_GRACE_POLLS = 6;

/**
 * Days CloudWatch keeps a migration's log lines (`/ecs/{name}-migration`),
 * the same as service logs. The CLI creates that group, not Terraform, so
 * the CLI sets its retention.
 */
export const ECS_MIGRATION_LOG_RETENTION_DAYS = 30;
