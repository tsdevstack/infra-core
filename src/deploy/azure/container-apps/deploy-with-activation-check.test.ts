import { describe, it, expect, rs, beforeEach } from '@rstest/core';

rs.mock('./create-or-update-container-app.ts', () => ({
  createOrUpdateContainerApp: rs.fn(),
}));
rs.mock('./wait-for-container-app-ready.ts', () => ({
  waitForContainerAppReady: rs.fn(),
}));
rs.mock('./wait-for-container-app-activation.ts', () => ({
  waitForContainerAppActivation: rs.fn(),
}));

import { deployWithActivationCheck } from './deploy-with-activation-check';
import { createOrUpdateContainerApp } from './create-or-update-container-app';
import { waitForContainerAppReady } from './wait-for-container-app-ready';
import { waitForContainerAppActivation } from './wait-for-container-app-activation';
import type { InfraCoreRuntime } from '../../../types/runtime';

describe('deployWithActivationCheck', () => {
  const mockRuntime = {} as InfraCoreRuntime;
  const mockCredentials = {
    clientId: 'client-123',
    tenantId: 'tenant-456',
    subscriptionId: 'sub-789',
    location: 'eastus',
  };
  const mockLogger = { info: rs.fn(), warn: rs.fn() };

  const baseOptions = {
    runtime: mockRuntime,
    credentials: mockCredentials,
    resourceGroupName: 'test-rg',
    containerAppName: 'test-app',
    createOptions: {
      credentials: mockCredentials,
      resourceGroupName: 'test-rg',
      containerAppName: 'test-app',
      containerAppsEnvId: 'env-id',
      image: 'myacr.azurecr.io/service:abc123',
      minReplicas: 1,
      maxReplicas: 3,
    },
    needsActivationCheck: false,
    targetMinReplicas: 0,
    logger: mockLogger,
  };

  beforeEach(() => {
    rs.restoreAllMocks();
    rs.mocked(createOrUpdateContainerApp).mockResolvedValue({
      fqdn: 'test-app.eastus.azurecontainerapps.io',
    });
    rs.mocked(waitForContainerAppReady).mockResolvedValue({
      status: 'Running',
    });
    rs.mocked(waitForContainerAppActivation).mockResolvedValue({
      healthy: true,
    });
  });

  describe('without activation check', () => {
    it('should deploy and return success', async () => {
      const result = await deployWithActivationCheck(baseOptions);

      expect(result.activated).toBe(true);
      expect(result.fqdn).toBe('test-app.eastus.azurecontainerapps.io');
      expect(createOrUpdateContainerApp).toHaveBeenCalledTimes(1);
      expect(waitForContainerAppReady).toHaveBeenCalledTimes(1);
      expect(waitForContainerAppActivation).not.toHaveBeenCalled();
    });

    it('should return error on deploy failure', async () => {
      rs.mocked(createOrUpdateContainerApp).mockRejectedValue(
        new Error('Deploy failed'),
      );

      const result = await deployWithActivationCheck(baseOptions);

      expect(result.activated).toBe(false);
      expect(result.error).toBe('Deploy failed');
    });

    it('should return error on ready timeout', async () => {
      rs.mocked(waitForContainerAppReady).mockRejectedValue(
        new Error('Timeout waiting for ready state'),
      );

      const result = await deployWithActivationCheck(baseOptions);

      expect(result.activated).toBe(false);
      expect(result.error).toBe('Timeout waiting for ready state');
    });
  });

  describe('with activation check', () => {
    const activationOptions = {
      ...baseOptions,
      needsActivationCheck: true,
      targetMinReplicas: 0,
      maxRetries: 2,
      retryDelayMs: 0,
    };

    it('should verify activation and scale back on success', async () => {
      const result = await deployWithActivationCheck(activationOptions);

      expect(result.activated).toBe(true);
      expect(waitForContainerAppActivation).toHaveBeenCalledTimes(1);
      // Scale back call
      expect(createOrUpdateContainerApp).toHaveBeenCalledTimes(2);
      expect(createOrUpdateContainerApp).toHaveBeenLastCalledWith(
        mockRuntime,
        expect.objectContaining({ minReplicas: 0 }),
      );
    });

    it('should retry activation check on failure', async () => {
      rs.mocked(waitForContainerAppActivation)
        .mockResolvedValueOnce({ healthy: false, error: 'RBAC not ready' })
        .mockResolvedValueOnce({ healthy: true });

      const result = await deployWithActivationCheck(activationOptions);

      expect(result.activated).toBe(true);
      // Deploy once + scale back once
      expect(createOrUpdateContainerApp).toHaveBeenCalledTimes(2);
      // Activation checked twice
      expect(waitForContainerAppActivation).toHaveBeenCalledTimes(2);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('RBAC propagating'),
      );
    });

    it('should return error after all retries exhausted', async () => {
      rs.mocked(waitForContainerAppActivation).mockResolvedValue({
        healthy: false,
        error: 'ImagePullBackOff',
      });

      const result = await deployWithActivationCheck(activationOptions);

      expect(result.activated).toBe(false);
      expect(result.error).toContain('Activation failed after 2 retries');
      expect(result.error).toContain('ImagePullBackOff');
    });

    it('should warn but not fail if scale-back fails', async () => {
      rs.mocked(createOrUpdateContainerApp)
        .mockResolvedValueOnce({ fqdn: 'test.io' })
        .mockRejectedValueOnce(new Error('Scale back failed'));

      const result = await deployWithActivationCheck(activationOptions);

      expect(result.activated).toBe(true);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Could not scale'),
      );
    });
  });
});
