import { describe, it, expect, rs, beforeEach } from '@rstest/core';

const { mockEcsSend } = rs.hoisted(() => ({
  mockEcsSend: rs.fn(),
}));
rs.mock('@aws-sdk/client-ecs', () => ({
  ECSClient: class {
    send = mockEcsSend;
  },
  RunTaskCommand: class {
    constructor(public input: unknown) {}
  },
  DescribeTasksCommand: class {
    constructor(public input: unknown) {}
  },
}));
rs.mock('../../../utils/async/sleep.ts', () => ({
  sleep: rs.fn(async () => {}),
}));

import { runEcsTaskAndWait } from './run-ecs-task-and-wait';

const runtime = {
  isCIEnv: () => false,
  logger: { info: rs.fn(), success: rs.fn(), warn: rs.fn(), error: rs.fn() },
} as unknown as Parameters<typeof runEcsTaskAndWait>[0];

const taskArn = 'arn:aws:ecs:eu-west-1:123456789012:task/shop-cluster/t1';
const options = {
  credentials: {
    accessKeyId: 'AKIA',
    secretAccessKey: 'secret',
    region: 'eu-west-1',
    accountId: '123456789012',
  },
  cluster: 'arn:aws:ecs:eu-west-1:123456789012:cluster/shop-cluster',
  taskDefinitionArn: 'arn:td:7',
  subnets: ['subnet-a'],
  securityGroups: ['sg-1'],
  containerName: 'cron-usage-report',
  timeoutSeconds: 660,
  startedBy: 'tsdevstack-run-cron',
};
const stopped = (exitCode?: number) => ({
  tasks: [
    {
      lastStatus: 'STOPPED',
      stoppedReason: 'Essential container in task exited',
      containers: [{ name: 'cron-usage-report', exitCode }],
    },
  ],
});

describe('runEcsTaskAndWait', () => {
  beforeEach(() => {
    rs.clearAllMocks();
  });

  it('should start the task in the given network and report a run that exits 0', async () => {
    mockEcsSend
      .mockResolvedValueOnce({ tasks: [{ taskArn }] })
      .mockResolvedValueOnce({ tasks: [{ lastStatus: 'RUNNING' }] })
      .mockResolvedValueOnce(stopped(0));

    await expect(runEcsTaskAndWait(runtime, options)).resolves.toEqual({
      success: true,
      taskArn,
      exitCode: 0,
    });
    expect(mockEcsSend.mock.calls[0][0].input).toEqual({
      cluster: options.cluster,
      taskDefinition: 'arn:td:7',
      launchType: 'FARGATE',
      count: 1,
      startedBy: 'tsdevstack-run-cron',
      networkConfiguration: {
        awsvpcConfiguration: {
          subnets: ['subnet-a'],
          securityGroups: ['sg-1'],
          assignPublicIp: 'DISABLED',
        },
      },
    });
  });

  it('should report a failed run with its exit code and reason', async () => {
    mockEcsSend
      .mockResolvedValueOnce({ tasks: [{ taskArn }] })
      .mockResolvedValueOnce(stopped(1));

    const result = await runEcsTaskAndWait(runtime, options);

    expect(result).toEqual({
      success: false,
      taskArn,
      exitCode: 1,
      reason: 'Essential container in task exited',
    });
  });

  it('should count a 200 answer with failures as a refused start', async () => {
    mockEcsSend.mockResolvedValueOnce({
      tasks: [],
      failures: [{ reason: 'RESOURCE:CPU', detail: 'no capacity' }],
    });

    await expect(runEcsTaskAndWait(runtime, options)).rejects.toMatchObject({
      name: 'InfraCoreError',
      message: 'ECS did not start the task',
      hint: 'RESOURCE:CPU: no capacity',
    });
  });

  it("should keep the API's error as the cause of a refused start", async () => {
    const apiError = Object.assign(
      new Error('Unable to find task definition'),
      {
        name: 'ClientException',
      },
    );
    mockEcsSend.mockRejectedValueOnce(apiError);

    await expect(runEcsTaskAndWait(runtime, options)).rejects.toMatchObject({
      message: 'Failed to start the task',
      cause: apiError,
    });
  });

  it('should read a STOPPED task again until its exit code is there', async () => {
    mockEcsSend
      .mockResolvedValueOnce({ tasks: [{ taskArn }] })
      .mockResolvedValueOnce(stopped(undefined))
      .mockResolvedValueOnce(stopped(0));

    await expect(runEcsTaskAndWait(runtime, options)).resolves.toMatchObject({
      success: true,
    });
  });
});
