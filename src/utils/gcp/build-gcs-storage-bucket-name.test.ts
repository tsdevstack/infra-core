import { describe, it, expect } from '@rstest/core';
import { buildGcsStorageBucketName } from './build-gcs-storage-bucket-name';

const base = {
  projectName: 'myapp',
  bucket: 'avatars',
  environment: 'dev',
  gcpProjectId: 'my-gcp-project',
};

describe('buildGcsStorageBucketName', () => {
  describe('Standard use cases', () => {
    it('should add the GCP project suffix in the unique scheme', () => {
      expect(buildGcsStorageBucketName({ ...base, naming: 'unique' })).toBe(
        'myapp-avatars-dev-ffe340',
      );
    });

    it('should keep the name a legacy environment has', () => {
      expect(buildGcsStorageBucketName({ ...base, naming: 'legacy' })).toBe(
        'myapp-avatars-dev',
      );
    });
  });

  describe('Edge cases', () => {
    it('should give two GCP projects different names for the same project name', () => {
      expect(buildGcsStorageBucketName({ ...base, naming: 'unique' })).not.toBe(
        buildGcsStorageBucketName({
          ...base,
          gcpProjectId: 'other-project',
          naming: 'unique',
        }),
      );
    });
  });
});
