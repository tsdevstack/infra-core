import { describe, it, expect, rs } from '@rstest/core';
import { dockerLoginWithRetry } from './docker-login-with-retry.ts';

describe('dockerLoginWithRetry', () => {
  it('should succeed on first attempt', async () => {
    const loginFn = rs.fn();

    await dockerLoginWithRetry(loginFn, { maxRetries: 3, delayMs: 0 });

    expect(loginFn).toHaveBeenCalledTimes(1);
  });

  it('should retry on failure and succeed', async () => {
    const loginFn = rs.fn();
    loginFn.mockImplementationOnce(() => {
      throw new Error('connection refused');
    });
    loginFn.mockImplementationOnce(() => {
      // succeeds
    });

    await dockerLoginWithRetry(loginFn, { maxRetries: 3, delayMs: 0 });

    expect(loginFn).toHaveBeenCalledTimes(2);
  });

  it('should throw after all retries exhausted', async () => {
    const loginFn = rs.fn(() => {
      throw new Error('persistent failure');
    });

    await expect(
      dockerLoginWithRetry(loginFn, { maxRetries: 3, delayMs: 0 }),
    ).rejects.toThrow('persistent failure');

    expect(loginFn).toHaveBeenCalledTimes(3);
  });

  it('should use default maxRetries of 3', async () => {
    const loginFn = rs.fn(() => {
      throw new Error('fail');
    });

    await expect(dockerLoginWithRetry(loginFn, { delayMs: 0 })).rejects.toThrow(
      'fail',
    );

    expect(loginFn).toHaveBeenCalledTimes(3);
  });

  it('should succeed on last attempt', async () => {
    const loginFn = rs.fn();
    loginFn.mockImplementationOnce(() => {
      throw new Error('fail 1');
    });
    loginFn.mockImplementationOnce(() => {
      throw new Error('fail 2');
    });
    loginFn.mockImplementationOnce(() => {
      // succeeds on third attempt
    });

    await dockerLoginWithRetry(loginFn, { maxRetries: 3, delayMs: 0 });

    expect(loginFn).toHaveBeenCalledTimes(3);
  });

  it('should throw the last error when all retries fail', async () => {
    const loginFn = rs.fn();
    loginFn.mockImplementationOnce(() => {
      throw new Error('first error');
    });
    loginFn.mockImplementationOnce(() => {
      throw new Error('second error');
    });
    loginFn.mockImplementationOnce(() => {
      throw new Error('third error');
    });

    await expect(
      dockerLoginWithRetry(loginFn, { maxRetries: 3, delayMs: 0 }),
    ).rejects.toThrow('third error');
  });
});
