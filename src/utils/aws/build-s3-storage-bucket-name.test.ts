import { describe, it, expect } from '@rstest/core';
import { buildS3StorageBucketName } from './build-s3-storage-bucket-name';

describe('buildS3StorageBucketName', () => {
  describe('Standard use cases', () => {
    it('should name the bucket after the project, bucket, environment and account', () => {
      expect(
        buildS3StorageBucketName({
          projectName: 'shop',
          bucket: 'uploads',
          environment: 'dev',
          accountId: '123456789012',
        }),
      ).toBe('shop-uploads-dev-123456789012');
    });
  });

  describe('Edge cases', () => {
    it('should keep hyphens in the bucket name', () => {
      expect(
        buildS3StorageBucketName({
          projectName: 'shop',
          bucket: 'media-assets',
          environment: 'prod',
          accountId: '1',
        }),
      ).toBe('shop-media-assets-prod-1');
    });
  });
});
