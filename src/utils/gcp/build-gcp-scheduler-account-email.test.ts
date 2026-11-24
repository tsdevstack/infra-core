import { describe, it, expect } from '@rstest/core';
import { buildGcpSchedulerAccountEmail } from './build-gcp-scheduler-account-email';

describe('buildGcpSchedulerAccountEmail', () => {
  it("should name the project's scheduler account in the GCP project", () => {
    expect(buildGcpSchedulerAccountEmail('shop', 'gcp-shop-dev')).toBe(
      'shop-scheduler@gcp-shop-dev.iam.gserviceaccount.com',
    );
  });
});
