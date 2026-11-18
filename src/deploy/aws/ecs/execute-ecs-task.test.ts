import { describe, it, expect, rs, beforeEach } from '@rstest/core';

const mockEcsSend = rs.fn();
const mockLogsSend = rs.fn();

rs.mock('@aws-sdk/client-ecs', () => {
  const command = (type: string) =>
    rs.fn().mockImplementation(function (params) {
      return { _type: type, _params: params };
    });
  return {
    ECSClient: rs.fn().mockImplementation(function () {
      return { send: mockEcsSend };
    }),
    RegisterTaskDefinitionCommand: command('register'),
    RunTaskCommand: command('run'),
    DescribeTasksCommand: command('describe'),
    DeregisterTaskDefinitionCommand: command('deregister'),
  };
});

rs.mock('@aws-sdk/client-cloudwatch-logs', () => {
  const command = (type: string) =>
    rs.fn().mockImplementation(function (params) {
      return { _type: type, _params: params };
    });
  return {
    CloudWatchLogsClient: rs.fn().mockImplementation(function () {
      return { send: mockLogsSend };
    }),
    CreateLogGroupCommand: command('create-log-group'),
    PutRetentionPolicyCommand: command('put-retention'),
    GetLogEventsCommand: command('get-log-events'),
  };
});

rs.mock('../../../utils/async/sleep.ts', () => ({
  sleep: rs.fn(() => Promise.resolve()),
}));

import { executeEcsTask } from './execute-ecs-task';

const mockRuntime = {
  logger: {
    info: rs.fn(),
    success: rs.fn(),
    error: rs.fn(),
    warn: rs.fn(),
    debug: rs.fn(),
    newline: rs.fn(),
    generating: rs.fn(),
    running: rs.fn(),
    creating: rs.fn(),
    building: rs.fn(),
    checking: rs.fn(),
    complete: rs.fn(),
  },
  executeCommand: rs.fn(),
  writeFile: rs.fn(),
  readFile: rs.fn(),
  ensureDirectory: rs.fn(),
  cleanupFolder: rs.fn(),
  isCIEnv: rs.fn(),
};

const options = {
  region: 'us-east-1',
  clusterName: 'test-cluster',
  taskName: 'migrate-offers-service',
  taskFamily: 'myapp-migrate-offers-service',
  logGroupName: '/ecs/myapp/migrate-offers-service',
  imageUri: '123456789012.dkr.ecr.us-east-1.amazonaws.com/app:tag',
  command: ['npx', 'prisma', 'migrate', 'deploy'],
  subnetIds: ['subnet-1'],
  securityGroupId: 'sg-1',
  executionRoleArn: 'arn:aws:iam::123456789012:role/exec',
  taskRoleArn: 'arn:aws:iam::123456789012:role/task',
  secretArn: 'arn:aws:secretsmanager:us-east-1:123456789012:secret:db',
  credentials: {
    region: 'us-east-1',
    accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
    secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
    accountId: '123456789012',
  },
};

/** Routes ECS calls by command type; describe answers come from the list in order */
function mockEcs(describeTasks: Array<Record<string, unknown>>): void {
  let describeCall = 0;
  mockEcsSend.mockImplementation(async (cmd: { _type: string }) => {
    if (cmd._type === 'register') {
      return { taskDefinition: { taskDefinitionArn: 'arn:task-def:1' } };
    }
    if (cmd._type === 'run') {
      return { tasks: [{ taskArn: 'arn:aws:ecs:us-east-1:1:task/c/abc123' }] };
    }
    if (cmd._type === 'describe') {
      const task =
        describeTasks[Math.min(describeCall, describeTasks.length - 1)];
      describeCall += 1;
      return { tasks: [task] };
    }
    return {};
  });
}

function describeCalls(): number {
  return mockEcsSend.mock.calls.filter(
    ([cmd]) => (cmd as { _type: string })._type === 'describe',
  ).length;
}

describe('executeEcsTask', () => {
  beforeEach(() => {
    rs.clearAllMocks();
    mockEcsSend.mockReset();
    mockLogsSend.mockReset();
    mockRuntime.isCIEnv.mockReturnValue(false);
    mockLogsSend.mockImplementation(async (cmd: { _type: string }) =>
      cmd._type === 'get-log-events'
        ? { events: [{ message: 'No pending migrations to apply.' }] }
        : {},
    );
  });

  describe('Standard use cases', () => {
    it('should succeed when the migration container exits 0', async () => {
      mockEcs([
        { lastStatus: 'PENDING' },
        {
          lastStatus: 'STOPPED',
          containers: [{ name: 'migration', exitCode: 0 }],
        },
      ]);

      const result = await executeEcsTask(mockRuntime, options);

      expect(result.success).toBe(true);
      expect(result.logs).toBe('No pending migrations to apply.');
      expect(mockRuntime.logger.success).toHaveBeenCalledWith(
        'Task completed successfully',
      );
    });

    it("should keep the migration's log lines for 30 days", async () => {
      mockEcs([
        {
          lastStatus: 'STOPPED',
          containers: [{ name: 'migration', exitCode: 0 }],
        },
      ]);

      await executeEcsTask(mockRuntime, options);

      const retention = mockLogsSend.mock.calls
        .map(([cmd]) => cmd as { _type: string; _params: unknown })
        .find((cmd) => cmd._type === 'put-retention');
      expect(retention?._params).toEqual({
        logGroupName: '/ecs/myapp/migrate-offers-service',
        retentionInDays: 30,
      });
    });

    it('should register the given family and log to the given group', async () => {
      mockEcs([
        {
          lastStatus: 'STOPPED',
          containers: [{ name: 'migration', exitCode: 0 }],
        },
      ]);

      await executeEcsTask(mockRuntime, options);

      const register = mockEcsSend.mock.calls
        .map(
          ([cmd]) => cmd as { _type: string; _params: Record<string, unknown> },
        )
        .find((cmd) => cmd._type === 'register');
      expect(register?._params.family).toBe('myapp-migrate-offers-service');
      expect(
        (
          register?._params.containerDefinitions as {
            logConfiguration: { options: Record<string, string> };
          }[]
        )[0].logConfiguration.options['awslogs-group'],
      ).toBe('/ecs/myapp/migrate-offers-service');
    });

    it('should fail with the exit code and stop reason when the container exits non-zero', async () => {
      mockEcs([
        {
          lastStatus: 'STOPPED',
          stoppedReason: 'Essential container in task exited',
          containers: [{ name: 'migration', exitCode: 1 }],
        },
      ]);

      const result = await executeEcsTask(mockRuntime, options);

      expect(result.success).toBe(false);
      expect(mockRuntime.logger.error).toHaveBeenCalledWith(
        'Task failed (exit code 1; Essential container in task exited)',
      );
    });
  });

  describe('Edge cases', () => {
    it('should keep polling when STOPPED arrives before the exit code, then succeed', async () => {
      mockEcs([
        { lastStatus: 'STOPPED', containers: [{ name: 'migration' }] },
        {
          lastStatus: 'STOPPED',
          containers: [{ name: 'migration', exitCode: 0 }],
        },
      ]);

      const result = await executeEcsTask(mockRuntime, options);

      expect(result.success).toBe(true);
      expect(describeCalls()).toBe(2);
    });

    it('should fail after the grace polls when the exit code never arrives', async () => {
      mockEcs([{ lastStatus: 'STOPPED', containers: [{ name: 'migration' }] }]);

      const result = await executeEcsTask(mockRuntime, options);

      expect(result.success).toBe(false);
      expect(describeCalls()).toBe(7);
      expect(mockRuntime.logger.error).toHaveBeenCalledWith(
        'Task failed (stopped, exit code not reported)',
      );
    });

    it('should read the migration container even when it is not the first', async () => {
      mockEcs([
        {
          lastStatus: 'STOPPED',
          containers: [
            { name: 'log-router', exitCode: 137 },
            { name: 'migration', exitCode: 0 },
          ],
        },
      ]);

      const result = await executeEcsTask(mockRuntime, options);

      expect(result.success).toBe(true);
    });

    it('should deregister the task definition when done', async () => {
      mockEcs([
        {
          lastStatus: 'STOPPED',
          containers: [{ name: 'migration', exitCode: 0 }],
        },
      ]);

      await executeEcsTask(mockRuntime, options);

      expect(
        mockEcsSend.mock.calls.some(
          ([cmd]) => (cmd as { _type: string })._type === 'deregister',
        ),
      ).toBe(true);
    });

    it('should run the migration when the retention cannot be set', async () => {
      mockEcs([
        {
          lastStatus: 'STOPPED',
          containers: [{ name: 'migration', exitCode: 0 }],
        },
      ]);
      mockLogsSend.mockImplementation(async (cmd: { _type: string }) => {
        if (cmd._type === 'put-retention') {
          throw new Error('AccessDeniedException');
        }
        return cmd._type === 'get-log-events'
          ? { events: [{ message: 'No pending migrations to apply.' }] }
          : {};
      });

      const result = await executeEcsTask(mockRuntime, options);

      expect(result.success).toBe(true);
      expect(mockRuntime.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Could not set the retention'),
      );
    });
  });
});
