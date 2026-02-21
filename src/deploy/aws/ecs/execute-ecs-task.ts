/**
 * ECS Task execution utility for running migrations
 *
 * Uses AWS SDK to run ECS tasks (similar to Cloud Run Jobs)
 * with VPC access for database connectivity.
 */

import {
  ECSClient,
  RunTaskCommand,
  DescribeTasksCommand,
  RegisterTaskDefinitionCommand,
  DeregisterTaskDefinitionCommand,
} from '@aws-sdk/client-ecs';
import {
  CloudWatchLogsClient,
  GetLogEventsCommand,
  CreateLogGroupCommand,
  type OutputLogEvent,
} from '@aws-sdk/client-cloudwatch-logs';
import type { InfraCoreRuntime } from '../../../types/runtime.ts';
import type { AWSCredentials } from '../../../types/credentials.ts';
import { InfraCoreError } from '../../../runtime/infra-core-error.ts';
import { sleep } from '../../../utils/async/sleep.ts';

export interface EcsTaskOptions {
  region: string;
  clusterName: string;
  taskName: string;
  imageUri: string;
  command: string[];
  subnetIds: string[];
  securityGroupId: string;
  executionRoleArn: string;
  taskRoleArn: string;
  secretArn: string;
  credentials: AWSCredentials;
  /** CPU in ECS units - '256', '512', '1024', '2048', '4096' (default: '1024') */
  cpu?: string;
  /** Memory in MiB - '512', '1024', '2048', '4096', '8192' (default: '2048') */
  memory?: string;
}

export interface EcsTaskResult {
  success: boolean;
  logs: string;
}

/**
 * Run an ECS task (one-off) and wait for completion
 */
export async function executeEcsTask(
  runtime: InfraCoreRuntime,
  options: EcsTaskOptions,
): Promise<EcsTaskResult> {
  const ecsConfig = runtime.isCIEnv()
    ? { region: options.region }
    : {
        region: options.region,
        credentials: {
          accessKeyId: options.credentials.accessKeyId,
          secretAccessKey: options.credentials.secretAccessKey,
        },
      };

  const ecs = new ECSClient(ecsConfig);
  const cloudwatch = new CloudWatchLogsClient(ecsConfig);

  const taskFamily = `${options.taskName}-migration`;
  const logGroup = `/ecs/${taskFamily}`;
  const logStreamPrefix = 'migration';

  // Create log group if it doesn't exist (execution role may not have CreateLogGroup permission)
  try {
    await cloudwatch.send(
      new CreateLogGroupCommand({ logGroupName: logGroup }),
    );
    runtime.logger.info(`Created log group: ${logGroup}`);
  } catch (error) {
    // Ignore if already exists
    if (
      !(error instanceof Error) ||
      !error.name.includes('ResourceAlreadyExistsException')
    ) {
      // Log but don't fail - the task might still work if log group exists
      runtime.logger.warn(`Could not create log group: ${logGroup}`);
    }
  }

  // Register a task definition for the migration
  runtime.logger.info(`Registering task definition: ${taskFamily}...`);
  let taskDefinitionArn: string;

  try {
    const registerResponse = await ecs.send(
      new RegisterTaskDefinitionCommand({
        family: taskFamily,
        networkMode: 'awsvpc',
        requiresCompatibilities: ['FARGATE'],
        cpu: options.cpu ?? '1024',
        memory: options.memory ?? '2048',
        executionRoleArn: options.executionRoleArn,
        taskRoleArn: options.taskRoleArn,
        containerDefinitions: [
          {
            name: 'migration',
            image: options.imageUri,
            command: options.command,
            essential: true,
            secrets: [
              {
                name: 'DATABASE_URL',
                valueFrom: options.secretArn,
              },
            ],
            logConfiguration: {
              logDriver: 'awslogs',
              options: {
                'awslogs-group': logGroup,
                'awslogs-region': options.region,
                'awslogs-stream-prefix': logStreamPrefix,
                'awslogs-create-group': 'true',
              },
            },
          },
        ],
      }),
    );

    const arn = registerResponse.taskDefinition?.taskDefinitionArn;
    if (!arn) {
      throw new Error('Task definition ARN not returned');
    }
    taskDefinitionArn = arn;
    runtime.logger.info(`Task definition registered: ${taskDefinitionArn}`);
  } catch (error) {
    throw new InfraCoreError(
      `Failed to register task definition: ${taskFamily}`,
      'ecs-task',
      error instanceof Error ? error.message : 'Unknown error',
    );
  }

  // Run the task
  runtime.logger.info(`Running ECS task: ${options.taskName}...`);
  let taskArn: string;

  try {
    const runResponse = await ecs.send(
      new RunTaskCommand({
        cluster: options.clusterName,
        taskDefinition: taskDefinitionArn,
        launchType: 'FARGATE',
        count: 1,
        networkConfiguration: {
          awsvpcConfiguration: {
            subnets: options.subnetIds,
            securityGroups: [options.securityGroupId],
            assignPublicIp: 'DISABLED',
          },
        },
      }),
    );

    if (!runResponse.tasks || runResponse.tasks.length === 0) {
      const failureReason =
        runResponse.failures?.[0]?.reason || 'Unknown failure';
      throw new Error(`Failed to start task: ${failureReason}`);
    }

    taskArn = runResponse.tasks[0].taskArn!;
    runtime.logger.info(`Task started: ${taskArn}`);
  } catch (error) {
    // Clean up task definition
    await deregisterTaskDefinition(ecs, taskDefinitionArn);

    throw new InfraCoreError(
      `Failed to run ECS task: ${options.taskName}`,
      'ecs-task',
      error instanceof Error ? error.message : 'Unknown error',
    );
  }

  // Poll for completion
  runtime.logger.info('Waiting for task to complete...');
  const maxWaitTime = 5 * 60 * 1000; // 5 minutes
  const pollInterval = 5000; // 5 seconds
  const startTime = Date.now();
  let taskSucceeded = false;

  // Extract task ID from ARN (last part after /)
  const arnParts = taskArn.split('/');
  const taskId = arnParts[arnParts.length - 1];

  while (Date.now() - startTime < maxWaitTime) {
    try {
      const describeResponse = await ecs.send(
        new DescribeTasksCommand({
          cluster: options.clusterName,
          tasks: [taskArn],
        }),
      );

      const task = describeResponse.tasks?.[0];
      if (!task) {
        throw new Error('Task not found');
      }

      const lastStatus = task.lastStatus;
      runtime.logger.info(`Task status: ${lastStatus}`);

      if (lastStatus === 'STOPPED') {
        // Check exit code
        const container = task.containers?.[0];
        const exitCode = container?.exitCode;

        taskSucceeded = exitCode === 0;
        break;
      }

      await sleep(pollInterval);
    } catch (error) {
      // Clean up task definition
      await deregisterTaskDefinition(ecs, taskDefinitionArn);

      throw new InfraCoreError(
        'Failed to check task status',
        'ecs-task',
        error instanceof Error ? error.message : 'Unknown error',
      );
    }
  }

  // Fetch logs
  runtime.logger.info('Fetching task logs...');
  let logs = '';

  try {
    // Log stream name format: {prefix}/{container-name}/{task-id}
    const logStreamName = `${logStreamPrefix}/migration/${taskId}`;

    const logsResponse = await cloudwatch.send(
      new GetLogEventsCommand({
        logGroupName: logGroup,
        logStreamName,
        startFromHead: true,
      }),
    );

    logs =
      logsResponse.events?.map((e: OutputLogEvent) => e.message).join('\n') ||
      'No logs available';
  } catch {
    logs = 'Failed to fetch logs (log stream may not exist yet)';
  }

  // Clean up task definition
  await deregisterTaskDefinition(ecs, taskDefinitionArn);

  if (taskSucceeded) {
    runtime.logger.success('Task completed successfully');
    return { success: true, logs };
  } else {
    runtime.logger.error('Task failed');
    return { success: false, logs };
  }
}

/**
 * Deregister a task definition (cleanup)
 */
async function deregisterTaskDefinition(
  ecs: ECSClient,
  taskDefinitionArn: string,
): Promise<void> {
  try {
    await ecs.send(
      new DeregisterTaskDefinitionCommand({
        taskDefinition: taskDefinitionArn,
      }),
    );
  } catch {
    // Ignore cleanup errors
  }
}
