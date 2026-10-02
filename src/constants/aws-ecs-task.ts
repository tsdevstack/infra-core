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
