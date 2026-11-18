import { describe, it, expect } from '@rstest/core';
import { buildAzureStorageContainerName } from './build-azure-storage-container-name';

describe('buildAzureStorageContainerName', () => {
  describe('Standard use cases', () => {
    it('should name the container {project}-{bucket}-{env}', () => {
      expect(
        buildAzureStorageContainerName({
          projectName: 'tsdevstack',
          bucket: 'avatars',
          environment: 'az5',
        }),
      ).toBe('tsdevstack-avatars-az5');
    });
  });
});
