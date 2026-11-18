import { describe, it, expect } from '@rstest/core';
import { buildAccountSuffix } from './build-account-suffix';

describe('buildAccountSuffix', () => {
  describe('Standard use cases', () => {
    it('should give six lowercase hex characters of the ID', () => {
      expect(buildAccountSuffix('my-gcp-project')).toBe('ffe340');
      expect(buildAccountSuffix('00000000-0000-0000-0000-000000000000')).toBe(
        '12b937',
      );
    });

    it('should give the same suffix for the same account', () => {
      expect(buildAccountSuffix('my-gcp-project')).toBe(
        buildAccountSuffix('my-gcp-project'),
      );
    });
  });

  describe('Edge cases', () => {
    it('should give different suffixes for different accounts', () => {
      expect(buildAccountSuffix('my-gcp-project')).not.toBe(
        buildAccountSuffix('other-project'),
      );
    });

    it('should fit Azure storage account names (letters and digits only)', () => {
      expect(buildAccountSuffix('any-account')).toMatch(/^[a-z0-9]{6}$/);
    });
  });
});
