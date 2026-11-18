import { describe, it, expect, rs, beforeEach } from '@rstest/core';
import { waitForCloudRunService } from './wait-for-cloud-run-service.ts';

const NAME = 'projects/p/locations/us-central1/services/shop-kong';
const READY = {
  name: NAME,
  uri: 'https://shop-kong.run.app',
  reconciling: false,
  terminalCondition: { state: 'CONDITION_SUCCEEDED' as const },
  latestCreatedRevision: `${NAME}/revisions/shop-kong-00002`,
  latestReadyRevision: `${NAME}/revisions/shop-kong-00002`,
};
const noAnswer = Object.assign(
  new Error(
    '4 DEADLINE_EXCEEDED: Deadline exceeded after 14.996s,name resolution: 0.001s',
  ),
  { code: 4 },
);

const logger = { info: rs.fn() };

function wait(
  promise: () => Promise<unknown>,
  getService: (name: string) => Promise<unknown>,
  maxWaitMs = 1_000,
) {
  return waitForCloudRunService({
    operation: { promise } as never,
    getService: getService as never,
    serviceName: NAME,
    logger,
    pollIntervalMs: 0,
    maxWaitMs,
  });
}

describe('waitForCloudRunService', () => {
  beforeEach(() => {
    rs.clearAllMocks();
  });

  describe('Standard use cases', () => {
    it("should return the operation's service when the wait goes through", async () => {
      const getService = rs.fn();

      await expect(
        wait(() => Promise.resolve([READY]), getService),
      ).resolves.toEqual(READY);
      expect(getService).not.toHaveBeenCalled();
    });

    it('should read the service until it is ready when a status check gets no answer', async () => {
      const getService = rs
        .fn()
        .mockResolvedValueOnce({ ...READY, reconciling: true })
        .mockRejectedValueOnce(
          Object.assign(new Error('14 UNAVAILABLE'), { code: 14 }),
        )
        .mockResolvedValueOnce(READY);

      await expect(
        wait(() => Promise.reject(noAnswer), getService),
      ).resolves.toEqual(READY);
      expect(getService).toHaveBeenCalledTimes(3);
      expect(getService).toHaveBeenCalledWith(NAME);
      expect(logger.info).toHaveBeenCalledWith(
        "No answer while waiting (4 DEADLINE_EXCEEDED: Deadline exceeded after 14.996s). Reading the service's state...",
      );
    });

    it("should fail with Google's message when the new revision failed", async () => {
      const getService = rs.fn().mockResolvedValue({
        ...READY,
        terminalCondition: {
          state: 'CONDITION_FAILED',
          message: 'The user-provided container failed to start',
        },
        latestReadyRevision: `${NAME}/revisions/shop-kong-00001`,
      });

      await expect(
        wait(() => Promise.reject(noAnswer), getService),
      ).rejects.toThrow('The user-provided container failed to start');
    });
  });

  describe('Edge cases', () => {
    it('should rethrow any other error at once', async () => {
      const getService = rs.fn();
      const denied = Object.assign(new Error('7 PERMISSION_DENIED'), {
        code: 7,
      });

      await expect(
        wait(() => Promise.reject(denied), getService),
      ).rejects.toThrow('7 PERMISSION_DENIED');
      expect(getService).not.toHaveBeenCalled();
    });

    it('should not count an older ready revision as the new one', async () => {
      const getService = rs.fn().mockResolvedValue({
        ...READY,
        latestReadyRevision: `${NAME}/revisions/shop-kong-00001`,
      });

      await expect(
        wait(() => Promise.reject(noAnswer), getService),
      ).rejects.toThrow('is not ready');
    });

    it('should give up after the longest wait', async () => {
      const getService = rs
        .fn()
        .mockResolvedValue({ ...READY, reconciling: true });

      await expect(
        wait(() => Promise.reject(noAnswer), getService, 0),
      ).rejects.toThrow('The deployment had not finished');
    });
  });
});
