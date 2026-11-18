import { describe, it, expect, rs, beforeEach } from '@rstest/core';
import type { InfraCoreRuntime } from '../../../types/runtime.ts';
import type { AWSCredentials } from '../../../types/credentials.ts';

interface MockCommand {
  type: string;
  input: Record<string, unknown>;
}

const mockSend = rs.fn();

function command(type: string) {
  return rs.fn().mockImplementation(function (input: Record<string, unknown>) {
    return { type, input };
  });
}

rs.mock('@aws-sdk/client-ecs', () => ({
  ECSClient: rs.fn().mockImplementation(function () {
    return { send: mockSend };
  }),
  DescribeServicesCommand: command('Describe'),
  UpdateServiceCommand: command('Update'),
  DeleteServiceCommand: command('Delete'),
}));

import { deleteEcsService } from './delete-ecs-service.ts';

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

function sent(): MockCommand[] {
  return mockSend.mock.calls.map(([c]) => c as MockCommand);
}

function describeReturns(services: { status: string }[]): void {
  mockSend.mockImplementation(async (c: MockCommand) =>
    c.type === 'Describe' ? { services } : {},
  );
}

describe('deleteEcsService', () => {
  beforeEach(() => {
    rs.clearAllMocks();
    mockSend.mockReset();
  });

  describe('Standard use cases', () => {
    it('should scale an active service to zero, then delete it', async () => {
      describeReturns([{ status: 'ACTIVE' }]);

      const result = await deleteEcsService(mockRuntime, OPTIONS);

      expect(sent().map((c) => c.type)).toEqual([
        'Describe',
        'Update',
        'Delete',
      ]);
      expect(sent()[1].input).toEqual({
        cluster: 'shop-cluster',
        service: 'shop-auth-service',
        desiredCount: 0,
      });
      expect(sent()[2].input).toEqual({
        cluster: 'shop-cluster',
        service: 'shop-auth-service',
        force: true,
      });
      expect(result).toEqual({ success: true, deleted: true });
    });

    it('should do nothing for a service that is already gone', async () => {
      describeReturns([{ status: 'INACTIVE' }]);

      const result = await deleteEcsService(mockRuntime, OPTIONS);

      expect(sent().map((c) => c.type)).toEqual(['Describe']);
      expect(result).toEqual({ success: true, deleted: false });
    });
  });

  describe('Edge cases', () => {
    it('should do nothing when ECS lists no such service', async () => {
      describeReturns([]);

      expect(await deleteEcsService(mockRuntime, OPTIONS)).toEqual({
        success: true,
        deleted: false,
      });
    });

    it('should treat ServiceNotFoundException as already deleted', async () => {
      mockSend.mockRejectedValue(
        Object.assign(new Error('not found'), {
          name: 'ServiceNotFoundException',
        }),
      );

      expect(await deleteEcsService(mockRuntime, OPTIONS)).toEqual({
        success: true,
        deleted: false,
      });
    });

    it("should report any other failure with ECS's message", async () => {
      mockSend.mockRejectedValue(new Error('AccessDeniedException'));

      expect(await deleteEcsService(mockRuntime, OPTIONS)).toEqual({
        success: false,
        deleted: false,
        error: 'AccessDeniedException',
      });
    });
  });
});
