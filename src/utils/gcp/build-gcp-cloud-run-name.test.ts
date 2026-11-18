import { describe, it, expect } from '@rstest/core';
import { buildGcpCloudRunName } from './build-gcp-cloud-run-name';

describe('buildGcpCloudRunName', () => {
  describe('Standard use cases', () => {
    it('should put the project in front in the unique scheme', () => {
      expect(buildGcpCloudRunName('myapp', 'auth-service', 'unique')).toBe(
        'myapp-auth-service',
      );
      expect(
        buildGcpCloudRunName('myapp', 'migrate-auth-service', 'unique'),
      ).toBe('myapp-migrate-auth-service');
    });

    it('should keep the bare name in a legacy environment', () => {
      expect(buildGcpCloudRunName('myapp', 'auth-service', 'legacy')).toBe(
        'auth-service',
      );
    });
  });
});
