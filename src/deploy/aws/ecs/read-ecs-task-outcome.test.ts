import { describe, it, expect } from '@rstest/core';
import { readEcsTaskOutcome } from './read-ecs-task-outcome';

describe('readEcsTaskOutcome', () => {
  describe('Standard use cases', () => {
    it('should report running while the task is not STOPPED', () => {
      expect(
        readEcsTaskOutcome({ lastStatus: 'PENDING' }, 'migration'),
      ).toEqual({ state: 'running', lastStatus: 'PENDING' });
    });

    it('should report succeeded for exit code 0', () => {
      const outcome = readEcsTaskOutcome(
        {
          lastStatus: 'STOPPED',
          stoppedReason: 'Essential container in task exited',
          containers: [{ name: 'migration', exitCode: 0 }],
        },
        'migration',
      );

      expect(outcome).toEqual({
        state: 'succeeded',
        lastStatus: 'STOPPED',
        exitCode: 0,
        reason: 'Essential container in task exited',
      });
    });

    it('should report failed with the exit code and both reasons', () => {
      const outcome = readEcsTaskOutcome(
        {
          lastStatus: 'STOPPED',
          stoppedReason: 'Essential container in task exited',
          containers: [
            { name: 'migration', exitCode: 1, reason: 'OutOfMemoryError' },
          ],
        },
        'migration',
      );

      expect(outcome.state).toBe('failed');
      expect(outcome.exitCode).toBe(1);
      expect(outcome.reason).toBe(
        'OutOfMemoryError; Essential container in task exited',
      );
    });
  });

  describe('Edge cases', () => {
    it('should report exit-code-pending when STOPPED has no exit code yet', () => {
      const outcome = readEcsTaskOutcome(
        { lastStatus: 'STOPPED', containers: [{ name: 'migration' }] },
        'migration',
      );

      expect(outcome.state).toBe('exit-code-pending');
      expect(outcome.exitCode).toBeUndefined();
    });

    it('should read the named container, not the first one', () => {
      const outcome = readEcsTaskOutcome(
        {
          lastStatus: 'STOPPED',
          containers: [
            { name: 'log-router', exitCode: 137 },
            { name: 'migration', exitCode: 0 },
          ],
        },
        'migration',
      );

      expect(outcome.state).toBe('succeeded');
    });

    it('should report exit-code-pending when the named container is missing', () => {
      const outcome = readEcsTaskOutcome(
        { lastStatus: 'STOPPED', containers: [{ name: 'other', exitCode: 0 }] },
        'migration',
      );

      expect(outcome.state).toBe('exit-code-pending');
    });

    it('should report UNKNOWN when ECS returns no status', () => {
      expect(readEcsTaskOutcome({}, 'migration')).toEqual({
        state: 'running',
        lastStatus: 'UNKNOWN',
      });
    });
  });
});
