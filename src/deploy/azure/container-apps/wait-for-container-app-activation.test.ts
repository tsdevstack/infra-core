/**
 * Tests for wait-for-container-app-activation
 */

import { describe, it, expect, rs, beforeEach, afterEach } from '@rstest/core';

const mockGet = rs.fn();
const mockGetRevision = rs.fn();

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
    containerAppsRevisions = {
      getRevision: mockGetRevision,
    };
    constructor() {}
  },
}));

import { waitForContainerAppActivation } from './wait-for-container-app-activation';

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

const baseOptions = {
  credentials: testCredentials,
  resourceGroupName: 'test-rg',
  containerAppName: 'test-app',
};

describe('waitForContainerAppActivation', () => {
  beforeEach(() => {
    rs.clearAllMocks();
    rs.useFakeTimers();
  });

  afterEach(() => {
    rs.useRealTimers();
  });

  describe('Healthy activation', () => {
    it('should return healthy when revision is Healthy with replicas', async () => {
      mockGet.mockResolvedValue({
        latestRevisionName: 'test-app--abc123',
      });
      mockGetRevision.mockResolvedValue({
        healthState: 'Healthy',
        runningState: 'Running',
        replicas: 1,
      });

      const result = await waitForContainerAppActivation(
        mockRuntime,
        baseOptions,
      );

      expect(result.healthy).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should poll until revision becomes healthy', async () => {
      mockGet.mockResolvedValue({
        latestRevisionName: 'test-app--abc123',
      });
      mockGetRevision
        .mockResolvedValueOnce({
          healthState: 'None',
          runningState: 'Processing',
          replicas: 0,
        })
        .mockResolvedValueOnce({
          healthState: 'Healthy',
          runningState: 'Running',
          replicas: 1,
        });

      const resultPromise = waitForContainerAppActivation(mockRuntime, {
        ...baseOptions,
        pollIntervalMs: 1000,
      });

      await rs.advanceTimersByTimeAsync(1000);

      const result = await resultPromise;

      expect(result.healthy).toBe(true);
      expect(mockGetRevision).toHaveBeenCalledTimes(2);
    });
  });

  describe('Activation failures', () => {
    it('should return unhealthy when revision reaches ActivationFailed', async () => {
      mockGet.mockResolvedValue({
        latestRevisionName: 'test-app--abc123',
      });
      mockGetRevision.mockResolvedValue({
        healthState: 'Unhealthy',
        runningState: 'ActivationFailed',
        replicas: 0,
      });

      const result = await waitForContainerAppActivation(
        mockRuntime,
        baseOptions,
      );

      expect(result.healthy).toBe(false);
      expect(result.error).toContain('ActivationFailed');
    });

    it('should return unhealthy when revision reaches Failed', async () => {
      mockGet.mockResolvedValue({
        latestRevisionName: 'test-app--abc123',
      });
      mockGetRevision.mockResolvedValue({
        healthState: 'Unhealthy',
        runningState: 'Failed',
        replicas: 0,
      });

      const result = await waitForContainerAppActivation(
        mockRuntime,
        baseOptions,
      );

      expect(result.healthy).toBe(false);
      expect(result.error).toContain('Failed');
    });

    it('should return unhealthy when revision reaches Degraded', async () => {
      mockGet.mockResolvedValue({
        latestRevisionName: 'test-app--abc123',
      });
      mockGetRevision.mockResolvedValue({
        healthState: 'Unhealthy',
        runningState: 'Degraded',
        replicas: 0,
      });

      const result = await waitForContainerAppActivation(
        mockRuntime,
        baseOptions,
      );

      expect(result.healthy).toBe(false);
      expect(result.error).toContain('Degraded');
    });
  });

  describe('Edge cases', () => {
    it('should wait when no latest revision name yet', async () => {
      mockGet
        .mockResolvedValueOnce({ latestRevisionName: undefined })
        .mockResolvedValueOnce({ latestRevisionName: 'test-app--abc123' });
      mockGetRevision.mockResolvedValue({
        healthState: 'Healthy',
        runningState: 'Running',
        replicas: 1,
      });

      const resultPromise = waitForContainerAppActivation(mockRuntime, {
        ...baseOptions,
        pollIntervalMs: 1000,
      });

      await rs.advanceTimersByTimeAsync(1000);

      const result = await resultPromise;

      expect(result.healthy).toBe(true);
    });

    it('should return error on API failure', async () => {
      mockGet.mockRejectedValue(new Error('Network error'));

      const result = await waitForContainerAppActivation(
        mockRuntime,
        baseOptions,
      );

      expect(result.healthy).toBe(false);
      expect(result.error).toBe('Network error');
    });

    it('should timeout when revision stays in Processing state', async () => {
      mockGet.mockResolvedValue({
        latestRevisionName: 'test-app--abc123',
      });
      mockGetRevision.mockResolvedValue({
        healthState: 'None',
        runningState: 'Processing',
        replicas: 0,
      });

      const resultPromise = waitForContainerAppActivation(mockRuntime, {
        ...baseOptions,
        timeoutMs: 3000,
        pollIntervalMs: 1000,
      });

      const assertion = expect(resultPromise).resolves.toEqual({
        healthy: false,
        error: 'Timeout waiting for activation (3000ms)',
      });

      await rs.advanceTimersByTimeAsync(4000);

      await assertion;
    });
  });
});
