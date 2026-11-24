/**
 * Run one ECS task from an existing task definition and wait for it to stop
 */

import {
  ECSClient,
  RunTaskCommand,
  DescribeTasksCommand,
} from '@aws-sdk/client-ecs';
import type { InfraCoreRuntime } from '../../../types/runtime.ts';
import type { AWSCredentials } from '../../../types/credentials.ts';
import { InfraCoreError } from '../../../runtime/infra-core-error.ts';
import { sleep } from '../../../utils/async/sleep.ts';
import { ECS_TASK_EXIT_CODE_GRACE_POLLS } from '../../../constants/aws-ecs-task.ts';
import { readEcsTaskOutcome } from './read-ecs-task-outcome.ts';

export interface RunEcsTaskAndWaitOptions {
  credentials: AWSCredentials;
  /** Cluster name or ARN */
  cluster: string;
  taskDefinitionArn: string;
  subnets: string[];
  securityGroups: string[];
  assignPublicIp?: boolean;
  /** The container whose exit code decides the outcome */
  containerName: string;
  /** The run's time limit in seconds; the wait is this plus 5 minutes for the start */
  timeoutSeconds: number;
  /** Who started it (the task's startedBy) */
  startedBy?: string;
}

export interface RunEcsTaskAndWaitResult {
  success: boolean;
  taskArn: string;
  exitCode?: number;
  /** ECS's stop reasons, when it gives them */
  reason?: string;
}

/** Seconds a run gets on top of its time limit to be placed and started */
const START_ALLOWANCE_SECONDS = 300;
const POLL_INTERVAL_MS = 5_000;

/**
 * RunTask answers HTTP 200 with a `failures` list when it can't place the
 * task (capacity, a missing definition): that is a refused start here, as
 * an exception is. A STOPPED task without its exit code yet is read again a
 * few times before it counts as failed. A failed run's log lines are the
 * caller's to read (infra:run-cron prints them as infra:logs does).
 *
 * @throws InfraCoreError when the task can't be started (`cause`: the API's
 *   error), its status can't be read, or it doesn't stop within the wait
 */
export async function runEcsTaskAndWait(
  runtime: InfraCoreRuntime,
  options: RunEcsTaskAndWaitOptions,
): Promise<RunEcsTaskAndWaitResult> {
  const clientConfig = runtime.isCIEnv()
    ? { region: options.credentials.region }
    : {
        region: options.credentials.region,
        credentials: {
          accessKeyId: options.credentials.accessKeyId,
          secretAccessKey: options.credentials.secretAccessKey,
        },
      };
  const ecs = new ECSClient(clientConfig);

  let started;
  try {
    started = await ecs.send(
      new RunTaskCommand({
        cluster: options.cluster,
        taskDefinition: options.taskDefinitionArn,
        launchType: 'FARGATE',
        count: 1,
        startedBy: options.startedBy,
        networkConfiguration: {
          awsvpcConfiguration: {
            subnets: options.subnets,
            securityGroups: options.securityGroups,
            assignPublicIp: options.assignPublicIp ? 'ENABLED' : 'DISABLED',
          },
        },
      }),
    );
  } catch (error) {
    throw new InfraCoreError(
      'Failed to start the task',
      'ecs-task',
      error instanceof Error ? error.message : 'Unknown error',
      { cause: error },
    );
  }

  const taskArn = started.tasks?.[0]?.taskArn;
  if (!taskArn) {
    const reasons = (started.failures ?? [])
      .map((failure) =>
        [failure.reason, failure.detail].filter(Boolean).join(': '),
      )
      .filter(Boolean);
    throw new InfraCoreError(
      'ECS did not start the task',
      'ecs-task',
      reasons.join('; ') || 'RunTask returned no task',
    );
  }
  runtime.logger.info(`Task started: ${taskArn}`);

  const maxWaitMs = (options.timeoutSeconds + START_ALLOWANCE_SECONDS) * 1000;
  const startTime = Date.now();
  let exitCodePendingPolls = 0;
  let outcome: ReturnType<typeof readEcsTaskOutcome> | undefined;

  while (Date.now() - startTime < maxWaitMs) {
    let task;
    try {
      const described = await ecs.send(
        new DescribeTasksCommand({
          cluster: options.cluster,
          tasks: [taskArn],
        }),
      );
      task = described.tasks?.[0];
    } catch (error) {
      throw new InfraCoreError(
        'Failed to read the task status',
        'ecs-task',
        error instanceof Error ? error.message : 'Unknown error',
        { cause: error },
      );
    }
    if (task) {
      outcome = readEcsTaskOutcome(task, options.containerName);
      if (outcome.state === 'succeeded' || outcome.state === 'failed') {
        break;
      }
      if (outcome.state === 'exit-code-pending') {
        exitCodePendingPolls += 1;
        if (exitCodePendingPolls > ECS_TASK_EXIT_CODE_GRACE_POLLS) {
          break;
        }
      }
    }
    await sleep(POLL_INTERVAL_MS);
  }

  if (!outcome || outcome.state === 'running') {
    throw new InfraCoreError(
      'The task did not stop within the wait',
      'ecs-task',
      `Still ${outcome?.lastStatus ?? 'starting'} after ${maxWaitMs / 1000} seconds; it carries on in ECS (${taskArn})`,
    );
  }

  if (outcome.state === 'succeeded') {
    return { success: true, taskArn, exitCode: outcome.exitCode };
  }

  return {
    success: false,
    taskArn,
    exitCode: outcome.exitCode,
    reason: outcome.reason,
  };
}
