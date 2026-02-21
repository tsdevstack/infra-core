import { describe, it, expect, rs, beforeEach, afterEach } from '@rstest/core';
import { sleep } from './sleep.ts';

describe('sleep', () => {
  beforeEach(() => {
    rs.useFakeTimers();
  });

  afterEach(() => {
    rs.useRealTimers();
  });

  it('should resolve after specified milliseconds', async () => {
    const promise = sleep(1000);

    rs.advanceTimersByTime(1000);

    await expect(promise).resolves.toBeUndefined();
  });

  it('should not resolve before specified time', async () => {
    let resolved = false;
    sleep(1000).then(() => {
      resolved = true;
    });

    rs.advanceTimersByTime(500);
    await Promise.resolve();

    expect(resolved).toBe(false);
  });

  it('should handle zero milliseconds', async () => {
    const promise = sleep(0);

    rs.advanceTimersByTime(0);

    await expect(promise).resolves.toBeUndefined();
  });
});
