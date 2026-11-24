import { describe, it, expect, rs, beforeEach } from '@rstest/core';

const { mockSend } = rs.hoisted(() => ({ mockSend: rs.fn() }));
rs.mock('@aws-sdk/client-ecs', () => ({
  ECSClient: class {
    send = mockSend;
  },
  DescribeTaskDefinitionCommand: class {
    constructor(public input: unknown) {}
  },
  RegisterTaskDefinitionCommand: class {
    constructor(public input: unknown) {}
  },
}));

import { registerEcsTaskDefinitionRevision } from './register-ecs-task-definition-revision';

const runtime = {
  isCIEnv: () => false,
  logger: { info: rs.fn(), success: rs.fn(), warn: rs.fn(), error: rs.fn() },
} as unknown as Parameters<typeof registerEcsTaskDefinitionRevision>[0];

const credentials = {
  accessKeyId: 'AKIA',
  secretAccessKey: 'secret',
  region: 'eu-west-1',
  accountId: '123456789012',
};

const base = {
  family: 'shop-cron-usage-report',
  networkMode: 'awsvpc',
  requiresCompatibilities: ['FARGATE'],
  cpu: '1024',
  memory: '2048',
  executionRoleArn: 'arn:aws:iam::123456789012:role/shop-ecs-execution',
  taskRoleArn: 'arn:aws:iam::123456789012:role/shop-auth-service-task',
  containerDefinitions: [
    {
      name: 'cron-usage-report',
      image: 'repo/auth-service:latest',
      command: ['dumb-init', 'node', 'dist/cron.js', 'usage-report'],
      environment: [
        { name: 'SERVICE_NAME', value: 'auth-service' },
        { name: 'CRON_JOB_TIMEOUT', value: '600' },
      ],
    },
  ],
};
const tags = [
  { key: 'Project', value: 'shop' },
  { key: 'tsdevstack-cron-job', value: 'usage-report' },
];

describe('registerEcsTaskDefinitionRevision', () => {
  beforeEach(() => {
    rs.clearAllMocks();
  });

  it('should register the latest revision with the image, environment and secrets replaced, tags kept', async () => {
    mockSend
      .mockResolvedValueOnce({ taskDefinition: base, tags })
      .mockResolvedValueOnce({
        taskDefinition: {
          taskDefinitionArn:
            'arn:aws:ecs:eu-west-1:123456789012:task-definition/shop-cron-usage-report:7',
        },
      });

    const result = await registerEcsTaskDefinitionRevision(runtime, {
      credentials,
      family: 'shop-cron-usage-report',
      imageUri: 'repo/auth-service:abc123',
      environment: { CRON_JOB_TIMEOUT: '1800' },
      secrets: { DATABASE_URL: 'arn:secret' },
    });

    expect(result).toEqual({
      taskDefinitionArn:
        'arn:aws:ecs:eu-west-1:123456789012:task-definition/shop-cron-usage-report:7',
      containerName: 'cron-usage-report',
    });
    expect(mockSend.mock.calls[0][0].input).toEqual({
      taskDefinition: 'shop-cron-usage-report',
      include: ['TAGS'],
    });
    expect(mockSend.mock.calls[1][0].input).toEqual({
      family: 'shop-cron-usage-report',
      networkMode: 'awsvpc',
      requiresCompatibilities: ['FARGATE'],
      cpu: '1024',
      memory: '2048',
      executionRoleArn: base.executionRoleArn,
      taskRoleArn: base.taskRoleArn,
      containerDefinitions: [
        {
          name: 'cron-usage-report',
          image: 'repo/auth-service:abc123',
          command: ['dumb-init', 'node', 'dist/cron.js', 'usage-report'],
          environment: [
            { name: 'SERVICE_NAME', value: 'auth-service' },
            { name: 'CRON_JOB_TIMEOUT', value: '1800' },
          ],
          secrets: [{ name: 'DATABASE_URL', valueFrom: 'arn:secret' }],
        },
      ],
      tags,
    });
  });

  it('should register no secrets when none are given', async () => {
    mockSend
      .mockResolvedValueOnce({ taskDefinition: base, tags: [] })
      .mockResolvedValueOnce({
        taskDefinition: { taskDefinitionArn: 'arn:td:8' },
      });

    await registerEcsTaskDefinitionRevision(runtime, {
      credentials,
      family: 'shop-cron-usage-report',
      imageUri: 'repo/auth-service:abc123',
    });

    const input = mockSend.mock.calls[1][0].input as {
      containerDefinitions: Array<{ secrets?: unknown }>;
      tags?: unknown;
    };
    expect(input.containerDefinitions[0].secrets).toBeUndefined();
    expect(input.tags).toBeUndefined();
  });

  it('should answer undefined for a family without a revision', async () => {
    mockSend.mockRejectedValueOnce(
      Object.assign(new Error('Unable to describe task definition.'), {
        name: 'ClientException',
      }),
    );

    await expect(
      registerEcsTaskDefinitionRevision(runtime, {
        credentials,
        family: 'shop-cron-nope',
        imageUri: 'x',
      }),
    ).resolves.toBeUndefined();
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it('should wrap a refused registration', async () => {
    mockSend
      .mockResolvedValueOnce({ taskDefinition: base, tags })
      .mockRejectedValueOnce(new Error('AccessDenied: ecs:TagResource'));

    await expect(
      registerEcsTaskDefinitionRevision(runtime, {
        credentials,
        family: 'shop-cron-usage-report',
        imageUri: 'x',
      }),
    ).rejects.toMatchObject({
      name: 'InfraCoreError',
      message: 'Failed to register a revision of shop-cron-usage-report',
      hint: 'AccessDenied: ecs:TagResource',
    });
  });
});
