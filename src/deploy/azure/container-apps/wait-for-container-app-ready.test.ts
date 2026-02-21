/**
 * Tests for wait-for-container-app-ready
 */

import { describe, it, expect, rs, beforeEach, afterEach } from '@rstest/core';

const mockGet = rs.fn();

// Mock createAzureCredential
rs.mock('../create-azure-credential', () => ({
  createAzureCredential: () => ({}),
}));

// Mock Azure Container Apps client
rs.mock('@azure/arm-appcontainers', () => ({
  ContainerAppsAPIClient: class MockContainerAppsAPIClient {
    containerApps = {
      get: mockGet,
    };
    constructor() {}
  },
}));

import { waitForContainerAppReady } from './wait-for-container-app-ready';

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

const testCredentials = {
  clientId: 'test-client-id',
  clientSecret: 'test-client-secret',
  tenantId: 'test-tenant-id',
  subscriptionId: 'test-subscription-id',
  location: 'eastus2',
};

describe('waitForContainerAppReady', () => {
  beforeEach(() => {
    rs.clearAllMocks();
    rs.useFakeTimers();
  });

  afterEach(() => {
    rs.useRealTimers();
  });

  describe('Standard use cases', () => {
    it('should return success when Container App is Succeeded on first poll', async () => {
      mockGet.mockResolvedValue({
        provisioningState: 'Succeeded',
      });

      const resultPromise = waitForContainerAppReady(mockRuntime, {
        credentials: testCredentials,
        resourceGroupName: 'test-rg',
        containerAppName: 'test-app',
      });

      const result = await resultPromise;

      expect(result.status).toBe('Succeeded');
      expect(mockGet).toHaveBeenCalledWith('test-rg', 'test-app');
    });

    it('should poll multiple times then succeed', async () => {
      mockGet
        .mockResolvedValueOnce({ provisioningState: 'InProgress' })
        .mockResolvedValueOnce({ provisioningState: 'InProgress' })
        .mockResolvedValueOnce({ provisioningState: 'Succeeded' });

      const resultPromise = waitForContainerAppReady(mockRuntime, {
        credentials: testCredentials,
        resourceGroupName: 'test-rg',
        containerAppName: 'test-app',
        pollIntervalMs: 1000,
      });

      // Advance through the first poll interval
      await rs.advanceTimersByTimeAsync(1000);
      // Advance through the second poll interval
      await rs.advanceTimersByTimeAsync(1000);

      const result = await resultPromise;

      expect(result.status).toBe('Succeeded');
      expect(mockGet).toHaveBeenCalledTimes(3);
    });
  });

  describe('Failure states', () => {
    it('should throw when Container App reaches Failed state', async () => {
      mockGet.mockResolvedValue({
        provisioningState: 'Failed',
      });

      await expect(
        waitForContainerAppReady(mockRuntime, {
          credentials: testCredentials,
          resourceGroupName: 'test-rg',
          containerAppName: 'test-app',
        }),
      ).rejects.toThrow('Container App reached Failed state');
    });

    it('should throw when Container App reaches Canceled state', async () => {
      mockGet.mockResolvedValue({
        provisioningState: 'Canceled',
      });

      await expect(
        waitForContainerAppReady(mockRuntime, {
          credentials: testCredentials,
          resourceGroupName: 'test-rg',
          containerAppName: 'test-app',
        }),
      ).rejects.toThrow('Container App reached Canceled state');
    });
  });

  describe('Error cases', () => {
    it('should throw on API error', async () => {
      mockGet.mockRejectedValue(new Error('Network error'));

      await expect(
        waitForContainerAppReady(mockRuntime, {
          credentials: testCredentials,
          resourceGroupName: 'test-rg',
          containerAppName: 'test-app',
        }),
      ).rejects.toThrow('Error polling Container App status');
    });

    it('should throw with generic message when error has no message', async () => {
      mockGet.mockRejectedValue({});

      await expect(
        waitForContainerAppReady(mockRuntime, {
          credentials: testCredentials,
          resourceGroupName: 'test-rg',
          containerAppName: 'test-app',
        }),
      ).rejects.toThrow('Error polling Container App status');
    });
  });

  describe('Timeout', () => {
    it('should throw when timeout is exceeded', async () => {
      mockGet.mockResolvedValue({
        provisioningState: 'InProgress',
      });

      const resultPromise = waitForContainerAppReady(mockRuntime, {
        credentials: testCredentials,
        resourceGroupName: 'test-rg',
        containerAppName: 'test-app',
        timeoutMs: 3000,
        pollIntervalMs: 1000,
      });

      // Register rejection handler before advancing timers to avoid unhandled rejection
      const assertion = expect(resultPromise).rejects.toThrow(
        'Timeout waiting for Container App to be ready (3000ms)',
      );

      // Advance past the timeout
      await rs.advanceTimersByTimeAsync(4000);

      await assertion;
    });
  });
});
