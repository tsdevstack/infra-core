/**
 * Read the outcome of a one-off ECS task from a DescribeTasks result
 */

import type { Task } from '@aws-sdk/client-ecs';

export interface EcsTaskOutcome {
  /**
   * running: not STOPPED yet
   * succeeded / failed: STOPPED with the container's exit code
   * exit-code-pending: STOPPED, but the exit code is not recorded yet
   */
  state: 'running' | 'succeeded' | 'failed' | 'exit-code-pending';
  lastStatus: string;
  exitCode?: number;
  /** Container reason and task stop reason, when ECS reports them */
  reason?: string;
}

/**
 * Decides from the named container, not the task's first container, and
 * treats a STOPPED task without an exit code as pending instead of failed.
 */
export function readEcsTaskOutcome(
  task: Task,
  containerName: string,
): EcsTaskOutcome {
  const lastStatus = task.lastStatus ?? 'UNKNOWN';

  if (lastStatus !== 'STOPPED') {
    return { state: 'running', lastStatus };
  }

  const container = task.containers?.find((c) => c.name === containerName);
  const reason =
    [container?.reason, task.stoppedReason].filter(Boolean).join('; ') ||
    undefined;

  if (container?.exitCode === undefined || container.exitCode === null) {
    return { state: 'exit-code-pending', lastStatus, reason };
  }

  return {
    state: container.exitCode === 0 ? 'succeeded' : 'failed',
    lastStatus,
    exitCode: container.exitCode,
    reason,
  };
}
