import { describe, it, expect } from '@rstest/core';
import { isTriggerJob } from './is-trigger-job';

describe('isTriggerJob', () => {
  it('should be true for an entry without a type and for type trigger', () => {
    expect(
      isTriggerJob({
        name: 'cleanup',
        schedule: '0 3 * * *',
        targetService: 'auth-service',
        endpoint: '/auth/jobs/cleanup',
      }),
    ).toBe(true);
    expect(
      isTriggerJob({
        name: 'cleanup',
        type: 'trigger',
        schedule: '0 3 * * *',
        targetService: 'auth-service',
        endpoint: '/auth/jobs/cleanup',
      }),
    ).toBe(true);
  });

  it('should be false for a cron job', () => {
    expect(
      isTriggerJob({
        name: 'report',
        type: 'cron',
        schedule: '0 3 * * *',
        targetService: 'auth-service',
      }),
    ).toBe(false);
  });
});
