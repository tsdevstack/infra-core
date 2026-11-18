import { describe, it, expect } from '@rstest/core';
import { buildAzureResourceName } from './build-azure-resource-name';

const base = {
  projectName: 'shop',
  environment: 'dev',
  subscriptionId: '00000000-0000-0000-0000-000000000000', // suffix 12b937
};
const legacy = { ...base, naming: 'legacy' as const };
const unique = { ...base, naming: 'unique' as const };

describe('buildAzureResourceName', () => {
  describe('Standard use cases', () => {
    it('should give a legacy environment the names it was deployed with', () => {
      expect(buildAzureResourceName('stateStorageAccount', legacy)).toBe(
        'shopdevtfstate',
      );
      expect(buildAzureResourceName('blobStorageAccount', legacy)).toBe(
        'shopdevstorage',
      );
      expect(buildAzureResourceName('containerRegistry', legacy)).toBe(
        'shopdevacr',
      );
      expect(
        buildAzureResourceName('appService', { ...legacy, app: 'kong' }),
      ).toBe('shop-dev-kong');
      expect(buildAzureResourceName('redis', legacy)).toBe('shop-dev-redis');
      expect(buildAzureResourceName('postgresServer', legacy)).toBe(
        'shop-dev-postgres',
      );
    });

    it('should add the subscription suffix in the unique scheme', () => {
      expect(buildAzureResourceName('stateStorageAccount', unique)).toBe(
        'shopdevtf12b937',
      );
      expect(buildAzureResourceName('blobStorageAccount', unique)).toBe(
        'shopdevst12b937',
      );
      expect(buildAzureResourceName('containerRegistry', unique)).toBe(
        'shopdevacr12b937',
      );
      expect(
        buildAzureResourceName('appService', { ...unique, app: 'frontend' }),
      ).toBe('shop-dev-frontend-12b937');
      expect(buildAzureResourceName('redis', unique)).toBe(
        'shop-dev-redis-12b937',
      );
      expect(buildAzureResourceName('postgresServer', unique)).toBe(
        'shop-dev-postgres-12b937',
      );
    });
  });

  describe('Saved databases', () => {
    it('should give the storage account the unique scheme in every environment', () => {
      expect(buildAzureResourceName('dbExportsStorageAccount', legacy)).toBe(
        'shopdevdbx12b937',
      );
      expect(buildAzureResourceName('dbExportsStorageAccount', unique)).toBe(
        'shopdevdbx12b937',
      );
    });

    it('should keep it within 24 letters and digits', () => {
      const name = buildAzureResourceName('dbExportsStorageAccount', {
        ...legacy,
        projectName: 'my-very-long-project-name',
        environment: 'staging',
      });
      expect(name).toHaveLength(24);
      expect(name).toMatch(/^[a-z0-9]+$/);
    });
  });

  describe('Edge cases', () => {
    it("should keep a long project's storage account within 24 characters", () => {
      const name = buildAzureResourceName('blobStorageAccount', {
        ...unique,
        projectName: 'my-very-long-project-name',
      });
      expect(name).toHaveLength(24);
      expect(name).toMatch(/^[a-z0-9]+$/);
    });
  });
});
