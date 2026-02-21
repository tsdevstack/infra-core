import { describe, it, expect, rs, beforeEach } from '@rstest/core';
import { waitForEcsStable } from './wait-for-ecs-stable';

const mockSend = rs.fn();

// Mock AWS SDK
rs.mock('@aws-sdk/client-ecs', () => ({
  ECSClient: rs.fn().mockImplementation(function () {
    return { send: mockSend };
  }),
  DescribeServicesCommand: rs.fn().mockImplementation(function (params) {
    return { _params: params };
  }),
}));

import { ECSClient } from '@aws-sdk/client-ecs';

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

describe('waitForEcsStable', () => {
  const mockCredentials = {
    region: 'us-east-1',
    accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
    secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
    accountId: '123456789012',
  };

  const baseOptions = {
    credentials: mockCredentials,
    clusterName: 'test-cluster',
    serviceName: 'test-service',
    timeoutMs: 1000,
    pollIntervalMs: 100,
  };

  beforeEach(() => {
    rs.clearAllMocks();
    mockSend.mockReset();
    mockRuntime.isCIEnv.mockReturnValue(false);
  });

  describe('successful stabilization', () => {
    it('should return success when service is already stable', async () => {
      mockSend.mockResolvedValueOnce({
        services: [
          {
            serviceName: 'test-service',
            runningCount: 2,
            desiredCount: 2,
            pendingCount: 0,
          },
        ],
      });

      const result = await waitForEcsStable(mockRuntime, baseOptions);
      expect(result.runningCount).toBe(2);
      expect(result.desiredCount).toBe(2);
    });

    it('should return success when running equals desired with no pending', async () => {
      mockSend.mockResolvedValueOnce({
        services: [
          {
            serviceName: 'test-service',
            runningCount: 1,
            desiredCount: 1,
            pendingCount: 0,
          },
        ],
      });

      const result = await waitForEcsStable(mockRuntime, baseOptions);
      expect(result.runningCount).toBe(1);
    });

    it('should poll until service stabilizes', async () => {
      // First call: not stable
      mockSend.mockResolvedValueOnce({
        services: [
          {
            serviceName: 'test-service',
            runningCount: 0,
            desiredCount: 1,
            pendingCount: 1,
          },
        ],
      });
      // Second call: stable
      mockSend.mockResolvedValueOnce({
        services: [
          {
            serviceName: 'test-service',
            runningCount: 1,
            desiredCount: 1,
            pendingCount: 0,
          },
        ],
      });

      const result = await waitForEcsStable(mockRuntime, baseOptions);
      expect(result.runningCount).toBe(1);
      expect(mockSend).toHaveBeenCalledTimes(2);
    });
  });

  describe('failure cases', () => {
    it('should throw when service not found', async () => {
      mockSend.mockResolvedValueOnce({
        services: [],
      });

      await expect(waitForEcsStable(mockRuntime, baseOptions)).rejects.toThrow(
        'Service test-service not found',
      );
    });

    it('should throw on API error', async () => {
      mockSend.mockRejectedValueOnce(new Error('Access Denied'));

      await expect(waitForEcsStable(mockRuntime, baseOptions)).rejects.toThrow(
        'Error checking ECS service status',
      );
    });

    it('should throw on timeout when service does not stabilize', async () => {
      mockSend.mockResolvedValue({
        services: [
          {
            serviceName: 'test-service',
            runningCount: 0,
            desiredCount: 1,
            pendingCount: 1,
          },
        ],
      });

      await expect(
        waitForEcsStable(mockRuntime, {
          ...baseOptions,
          timeoutMs: 200,
          pollIntervalMs: 50,
        }),
      ).rejects.toThrow('Timeout');
    });
  });

  describe('status callback', () => {
    it('should call onStatusUpdate with progress', async () => {
      const statusUpdates: string[] = [];
      mockSend.mockResolvedValueOnce({
        services: [
          {
            serviceName: 'test-service',
            runningCount: 0,
            desiredCount: 2,
            pendingCount: 2,
          },
        ],
      });
      mockSend.mockResolvedValueOnce({
        services: [
          {
            serviceName: 'test-service',
            runningCount: 2,
            desiredCount: 2,
            pendingCount: 0,
          },
        ],
      });

      await waitForEcsStable(mockRuntime, {
        ...baseOptions,
        onStatusUpdate: (status) => statusUpdates.push(status),
      });

      expect(statusUpdates.length).toBeGreaterThanOrEqual(1);
      expect(statusUpdates[0]).toContain('test-service');
      expect(statusUpdates[0]).toContain('0/2 running');
    });
  });

  describe('CI vs local environment', () => {
    it('should create client without credentials in CI', async () => {
      mockRuntime.isCIEnv.mockReturnValue(true);

      mockSend.mockResolvedValueOnce({
        services: [
          {
            serviceName: 'test-service',
            runningCount: 1,
            desiredCount: 1,
            pendingCount: 0,
          },
        ],
      });

      await waitForEcsStable(mockRuntime, baseOptions);
      expect(ECSClient).toHaveBeenCalledWith({ region: 'us-east-1' });
    });

    it('should create client with credentials locally', async () => {
      mockRuntime.isCIEnv.mockReturnValue(false);

      mockSend.mockResolvedValueOnce({
        services: [
          {
            serviceName: 'test-service',
            runningCount: 1,
            desiredCount: 1,
            pendingCount: 0,
          },
        ],
      });

      await waitForEcsStable(mockRuntime, baseOptions);
      expect(ECSClient).toHaveBeenCalledWith({
        region: 'us-east-1',
        credentials: {
          accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
          secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
        },
      });
    });
  });
});
