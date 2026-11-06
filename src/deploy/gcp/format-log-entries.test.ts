import { describe, it, expect } from '@rstest/core';
import { formatLogEntries } from './format-log-entries';

describe('formatLogEntries', () => {
  describe('Standard use cases', () => {
    it('should format plain text and JSON lines', () => {
      expect(
        formatLogEntries([
          {
            metadata: { timestamp: '2026-10-30T12:00:00Z', severity: 'INFO' },
            data: 'Applying migration 20261030_init',
          },
          {
            metadata: { timestamp: '2026-10-30T12:00:01Z', severity: 'ERROR' },
            data: { level: 'error', msg: 'Migration failed' },
          },
          {
            metadata: { timestamp: '2026-10-30T12:00:02Z' },
            data: { message: 'Done' },
          },
        ]),
      ).toBe(
        [
          '[2026-10-30T12:00:00Z] INFO: Applying migration 20261030_init',
          '[2026-10-30T12:00:01Z] ERROR: Migration failed',
          '[2026-10-30T12:00:02Z] INFO: Done',
        ].join('\n'),
      );
    });
  });

  describe('Edge cases', () => {
    it('should show JSON without a message as it is', () => {
      expect(formatLogEntries([{ metadata: {}, data: { code: 1 } }])).toBe(
        '[] INFO: {"code":1}',
      );
    });
  });
});
