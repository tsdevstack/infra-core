import { describe, it, expect } from '@rstest/core';
import { buildGCPClientOptions } from './build-gcp-client-options';

describe('buildGCPClientOptions', () => {
  describe('Standard use cases', () => {
    it('should include credentials when private_key is present', () => {
      const result = buildGCPClientOptions({
        project_id: 'my-project',
        client_email: 'sa@my-project.iam.gserviceaccount.com',
        private_key:
          '-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----',
        region: 'us-central1',
      });

      expect(result.projectId).toBe('my-project');
      expect(result.credentials).toEqual({
        client_email: 'sa@my-project.iam.gserviceaccount.com',
        private_key:
          '-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----',
      });
    });

    it('should omit credentials in ADC mode (no private_key)', () => {
      const result = buildGCPClientOptions({
        project_id: 'my-project',
        client_email: 'sa@my-project.iam.gserviceaccount.com',
        region: 'us-central1',
      });

      expect(result.projectId).toBe('my-project');
      expect(result.credentials).toBeUndefined();
    });
  });
});
