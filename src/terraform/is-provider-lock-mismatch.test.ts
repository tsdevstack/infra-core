import { describe, it, expect } from '@rstest/core';
import { isProviderLockMismatch } from './is-provider-lock-mismatch';

describe('isProviderLockMismatch', () => {
  describe('Standard use cases', () => {
    it('should detect the lock mismatch error', () => {
      const output = `
╷
│ Error: Failed to query available provider packages
│
│ Could not retrieve the list of available versions for provider
│ hashicorp/aws: locked provider registry.terraform.io/hashicorp/aws 5.100.0
│ does not match configured version constraint ~> 6.71; must use terraform
│ init -upgrade to allow selection of new versions
╵
`;
      expect(isProviderLockMismatch(output)).toBe(true);
    });

    it('should detect it in colored output', () => {
      const output =
        '\u001b[31m│\u001b[0m locked provider registry.terraform.io/hashicorp/google 5.45.2 does not match configured version constraint ~> 8.9';
      expect(isProviderLockMismatch(output)).toBe(true);
    });
  });

  describe('Edge cases', () => {
    it('should ignore other init errors', () => {
      expect(
        isProviderLockMismatch(
          'Error: Failed to get existing workspaces: storage: bucket does not exist',
        ),
      ).toBe(false);
    });

    it('should ignore empty output', () => {
      expect(isProviderLockMismatch('')).toBe(false);
    });
  });
});
