import { describe, it, expect } from '@rstest/core';
import { shouldDeleteOldSpaFile } from './should-delete-old-spa-file.ts';

const NOW = new Date('2026-11-09T12:00:00Z');

describe('shouldDeleteOldSpaFile', () => {
  describe('Standard use cases', () => {
    it('should keep a file uploaded less than a day ago', () => {
      expect(
        shouldDeleteOldSpaFile(new Date('2026-11-09T08:00:00Z'), NOW),
      ).toBe(false);
    });

    it('should delete a file last uploaded more than a day ago', () => {
      expect(
        shouldDeleteOldSpaFile(new Date('2026-11-08T11:59:59Z'), NOW),
      ).toBe(true);
    });
  });

  describe('Edge cases', () => {
    it('should keep a file uploaded exactly a day ago', () => {
      expect(
        shouldDeleteOldSpaFile(new Date('2026-11-08T12:00:00Z'), NOW),
      ).toBe(false);
    });

    it('should delete a file without an upload time', () => {
      expect(shouldDeleteOldSpaFile(undefined, NOW)).toBe(true);
    });

    it('should delete a file whose upload time is not a date', () => {
      expect(shouldDeleteOldSpaFile(new Date('not a date'), NOW)).toBe(true);
    });
  });
});
