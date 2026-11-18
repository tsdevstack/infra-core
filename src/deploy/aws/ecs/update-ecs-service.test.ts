import { describe, it, expect, rs, beforeEach } from '@rstest/core';
import type { InfraCoreRuntime } from '../../../types/runtime.ts';
import type { AWSCredentials } from '../../../types/credentials.ts';
import { InfraCoreError } from '../../../runtime/infra-core-error.ts';

const mockSend = rs.fn();

rs.mock('@aws-sdk/client-ecs', () => ({
  ECSClient: rs.fn().mockImplementation(function () {
    return { send: mockSend };
  }),
  UpdateServiceCommand: rs.fn().mockImplementation(function (
    input: Record<string, unknown>,
  ) {
    return { input };
  }),
}));

import { ECSClient } from '@aws-sdk/client-ecs';
import { updateEcsService } from './update-ecs-service.ts';

const mockRuntime: InfraCoreRuntime = {
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
  readFile: rs.fn(() => ''),
  ensureDirectory: rs.fn(),
  cleanupFolder: rs.fn(),
  isCIEnv: rs.fn(() => false),
};

const OPTIONS = {
  credentials: {
    accessKeyId: 'key-id',
    secretAccessKey: 'secret',
    region: 'eu-central-1',
  } as AWSCredentials,
  clusterName: 'shop-cluster',
  serviceName: 'shop-auth-service',
};

function sentInput(): Record<string, unknown> {
  return (mockSend.mock.calls[0][0] as { input: Record<string, unknown> })
    .input;
}

describe('updateEcsService', () => {
  beforeEach(() => {
    rs.clearAllMocks();
    rs.mocked(mockRuntime.isCIEnv).mockReturnValue(false);
    mockSend.mockResolvedValue({
      service: { deployments: [{ id: 'ecs-svc/123' }] },
    });
  });

  describe('Standard use cases', () => {
    it('should force a new deployment and return its ID', async () => {
      const result = await updateEcsService(mockRuntime, OPTIONS);

      expect(sentInput()).toEqual({
        cluster: 'shop-cluster',
        service: 'shop-auth-service',
        forceNewDeployment: true,
      });
      expect(result).toEqual({ deploymentId: 'ecs-svc/123' });
    });

    it('should deploy the given task definition', async () => {
      await updateEcsService(mockRuntime, {
        ...OPTIONS,
        taskDefinitionArn: 'arn:aws:ecs:task-definition/shop-auth:7',
      });

      expect(sentInput().taskDefinition).toBe(
        'arn:aws:ecs:task-definition/shop-auth:7',
      );
    });

    it("should leave the credentials to the SDK's own chain in CI", async () => {
      rs.mocked(mockRuntime.isCIEnv).mockReturnValue(true);

      await updateEcsService(mockRuntime, OPTIONS);

      expect(ECSClient).toHaveBeenCalledWith({ region: 'eu-central-1' });
    });
  });

  describe('Edge cases', () => {
    it('should not force a deployment when told not to', async () => {
      await updateEcsService(mockRuntime, {
        ...OPTIONS,
        forceNewDeployment: false,
      });

      expect(sentInput().forceNewDeployment).toBe(false);
    });

    it('should return no ID when ECS reports no deployment', async () => {
      mockSend.mockResolvedValue({});

      expect(await updateEcsService(mockRuntime, OPTIONS)).toEqual({
        deploymentId: undefined,
      });
    });

    it("should fail with ECS's message", async () => {
      mockSend.mockRejectedValue(new Error('ServiceNotActiveException'));

      const error = await updateEcsService(mockRuntime, OPTIONS).catch(
        (e: unknown) => e,
      );

      expect(error).toBeInstanceOf(InfraCoreError);
      expect((error as InfraCoreError).message).toBe(
        'Failed to update ECS service',
      );
      expect((error as InfraCoreError).hint).toBe('ServiceNotActiveException');
    });
  });
});
