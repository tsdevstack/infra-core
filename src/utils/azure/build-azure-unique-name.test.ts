import { describe, it, expect } from '@rstest/core';
import { buildAzureUniqueName } from './build-azure-unique-name';

const SUBSCRIPTION = '00000000-0000-0000-0000-000000000000'; // suffix 12b937

describe('buildAzureUniqueName', () => {
  describe('Standard use cases', () => {
    it('should keep the exact name in a legacy environment', () => {
      expect(
        buildAzureUniqueName({
          base: 'shop-dev-kong',
          naming: 'legacy',
          subscriptionId: SUBSCRIPTION,
          maxLength: 60,
        }),
      ).toBe('shop-dev-kong');
    });

    it('should add the suffix with a hyphen in the unique scheme', () => {
      expect(
        buildAzureUniqueName({
          base: 'shop-dev-kong',
          naming: 'unique',
          subscriptionId: SUBSCRIPTION,
          maxLength: 60,
        }),
      ).toBe('shop-dev-kong-12b937');
    });

    it('should add the suffix without a hyphen where only letters and digits are allowed', () => {
      expect(
        buildAzureUniqueName({
          base: 'shopdevtfstate',
          naming: 'unique',
          subscriptionId: SUBSCRIPTION,
          maxLength: 24,
          alphanumeric: true,
        }),
      ).toBe('shopdevtfstate12b937');
    });
  });

  describe('Edge cases', () => {
    it('should trim a name too long and end it with a hash of the full name', () => {
      const name = buildAzureUniqueName({
        base: `${'a'.repeat(30)}devtfstate`,
        naming: 'unique',
        subscriptionId: SUBSCRIPTION,
        maxLength: 24,
        alphanumeric: true,
      });
      expect(name).toBe(`${'a'.repeat(16)}655d3ce5`);
      expect(name).toHaveLength(24);
    });

    it('should keep the hyphen before the hash and drop a trailing one', () => {
      const name = buildAzureUniqueName({
        base: `shop-dev-${'b'.repeat(55)}`,
        naming: 'unique',
        subscriptionId: SUBSCRIPTION,
        maxLength: 60,
      });
      expect(name).toBe(`shop-dev-${'b'.repeat(42)}-904b486c`);
      expect(name.length).toBeLessThanOrEqual(60);
    });

    it('should drop characters other than letters and digits from an alphanumeric name', () => {
      expect(
        buildAzureUniqueName({
          base: 'my-shopqa-envacr',
          naming: 'unique',
          subscriptionId: SUBSCRIPTION,
          maxLength: 50,
          alphanumeric: true,
        }),
      ).toBe('myshopqaenvacr12b937');
    });
  });
});
