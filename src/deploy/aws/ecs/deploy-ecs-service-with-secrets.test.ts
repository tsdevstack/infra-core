import { describe, it, expect, rs, beforeEach } from '@rstest/core';

const mockEcsSend = rs.fn();

rs.mock('@aws-sdk/client-ecs', () => {
  const command = (type: string) =>
    rs.fn().mockImplementation(function (params) {
      return { _type: type, _params: params };
    });
  return {
    ECSClient: rs.fn().mockImplementation(function () {
      return { send: mockEcsSend };
    }),
    DescribeTaskDefinitionCommand: command('describe'),
    RegisterTaskDefinitionCommand: command('register'),
    UpdateServiceCommand: command('update'),
  };
});

import { deployEcsServiceWithSecrets } from './deploy-ecs-service-with-secrets';

const mockRuntime = {
  logger: {
    info: rs.fn(),
    success: rs.fn(),
    error: rs.fn(),
    warn: rs.fn(),
    debug: rs.fn(),
    newline: rs.fn(),
    generating: rs.fn(),
    complete: rs.fn(),
  },
  isCIEnv: () => false,
};

const credentials = {
  accountId: '123456789012',
  accessKeyId: 'key',
  secretAccessKey: 'secret',
  region: 'us-east-1',
};

const baseOptions = {
  credentials,
  projectName: 'my-app',
  clusterName: 'my-app-cluster',
  serviceName: 'frontend',
  imageUri: '123.dkr.ecr.us-east-1.amazonaws.com/my-app/frontend:abc',
  hasDatabase: false,
};

type SentCommand = { _type: string; _params: Record<string, unknown> };

const registeredContainer = (): Record<string, unknown> => {
  const register = mockEcsSend.mock.calls
    .map((call) => call[0] as SentCommand)
    .find((command) => command._type === 'register');
  const definitions = register?._params.containerDefinitions as Array<
    Record<string, unknown>
  >;
  return definitions[0];
};

describe('deployEcsServiceWithSecrets', () => {
  beforeEach(() => {
    rs.clearAllMocks();
    mockEcsSend.mockImplementation(async (command: SentCommand) => {
      if (command._type === 'describe') {
        return {
          taskDefinition: {
            family: 'my-app-frontend',
            networkMode: 'awsvpc',
            requiresCompatibilities: ['FARGATE'],
            cpu: '512',
            memory: '1024',
            executionRoleArn: 'arn:exec',
            taskRoleArn: 'arn:task',
            containerDefinitions: [
              {
                name: 'frontend',
                image: 'old',
                portMappings: [{ containerPort: 8080 }],
                environment: [
                  { name: 'NODE_ENV', value: 'production' },
                  { name: 'TSDEVSTACK_CLIENT_IP_HEADER', value: 'Old-Header' },
                ],
                logConfiguration: { logDriver: 'awslogs' },
                healthCheck: { command: ['CMD-SHELL', 'true'] },
                command: ['dumb-init', 'node', 'dist/worker.js'],
                essential: true,
              },
            ],
          },
        };
      }
      if (command._type === 'register') {
        return {
          taskDefinition: {
            taskDefinitionArn:
              'arn:aws:ecs:us-east-1:123:task-definition/my-app-frontend:2',
          },
        };
      }
      return { service: { deployments: [{ id: 'deploy-1' }] } };
    });
  });

  describe('Standard use cases', () => {
    it('should register the image and keep the environment', async () => {
      const result = await deployEcsServiceWithSecrets(
        mockRuntime as never,
        baseOptions,
      );

      expect(result.taskDefinitionArn).toContain('my-app-frontend:2');
      const container = registeredContainer();
      expect(container.image).toBe(baseOptions.imageUri);
      expect(container.environment).toEqual([
        { name: 'NODE_ENV', value: 'production' },
        { name: 'TSDEVSTACK_CLIENT_IP_HEADER', value: 'Old-Header' },
      ]);
    });

    it('should keep the rest of the container definition (a worker command)', async () => {
      await deployEcsServiceWithSecrets(mockRuntime as never, baseOptions);

      const container = registeredContainer();
      expect(container.command).toEqual([
        'dumb-init',
        'node',
        'dist/worker.js',
      ]);
      expect(container.portMappings).toEqual([{ containerPort: 8080 }]);
      expect(container.logConfiguration).toEqual({ logDriver: 'awslogs' });
      expect(container.healthCheck).toEqual({ command: ['CMD-SHELL', 'true'] });
      expect(container.essential).toBe(true);
    });

    it('should set additional environment variables over existing ones', async () => {
      await deployEcsServiceWithSecrets(mockRuntime as never, {
        ...baseOptions,
        additionalEnvironment: {
          TSDEVSTACK_CLIENT_IP_HEADER: 'X-Tsdevstack-Edge-IP',
          NEW_SETTING: 'yes',
        },
      });

      expect(registeredContainer().environment).toEqual([
        { name: 'NODE_ENV', value: 'production' },
        { name: 'TSDEVSTACK_CLIENT_IP_HEADER', value: 'X-Tsdevstack-Edge-IP' },
        { name: 'NEW_SETTING', value: 'yes' },
      ]);
    });

    it('should inject the database and additional secrets', async () => {
      await deployEcsServiceWithSecrets(mockRuntime as never, {
        ...baseOptions,
        hasDatabase: true,
        additionalSecrets: {
          API_URL:
            'arn:aws:secretsmanager:us-east-1:123:secret:my-app-shared-API_URL',
        },
      });

      expect(registeredContainer().secrets).toEqual([
        {
          name: 'DATABASE_URL',
          valueFrom:
            'arn:aws:secretsmanager:us-east-1:123456789012:secret:my-app-frontend-DATABASE_URL',
        },
        {
          name: 'API_URL',
          valueFrom:
            'arn:aws:secretsmanager:us-east-1:123:secret:my-app-shared-API_URL',
        },
      ]);
    });

    it('should update the service with the new task definition', async () => {
      await deployEcsServiceWithSecrets(mockRuntime as never, baseOptions);

      const update = mockEcsSend.mock.calls
        .map((call) => call[0] as SentCommand)
        .find((command) => command._type === 'update');
      expect(update?._params).toEqual(
        expect.objectContaining({
          cluster: 'my-app-cluster',
          service: 'frontend',
          taskDefinition:
            'arn:aws:ecs:us-east-1:123:task-definition/my-app-frontend:2',
          forceNewDeployment: true,
        }),
      );
    });
  });

  describe('Edge cases', () => {
    it('should fail when the task definition does not exist', async () => {
      mockEcsSend.mockResolvedValueOnce({ taskDefinition: undefined });

      await expect(
        deployEcsServiceWithSecrets(mockRuntime as never, baseOptions),
      ).rejects.toThrow('my-app-frontend not found');
    });
  });
});
