import { describe, it, expect } from '@rstest/core';
import { isCronJob } from './is-cron-job';

describe('isCronJob', () => {
  it('should be true for type cron', () => {
    expect(
      isCronJob({
        name: 'report',
        type: 'cron',
        schedule: '0 3 * * *',
        targetService: 'auth-service',
      }),
    ).toBe(true);
  });

  it('should be false for a trigger, with or without its type', () => {
    expect(
      isCronJob({
        name: 'cleanup',
        schedule: '0 3 * * *',
        targetService: 'auth-service',
        endpoint: '/auth/jobs/cleanup',
      }),
    ).toBe(false);
    expect(
      isCronJob({
        name: 'cleanup',
        type: 'trigger',
        schedule: '0 3 * * *',
        targetService: 'auth-service',
        endpoint: '/auth/jobs/cleanup',
      }),
    ).toBe(false);
  });
});
