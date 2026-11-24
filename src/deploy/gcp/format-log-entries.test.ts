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

  describe('Error lines', () => {
    it("should add the backend logger's error message", () => {
      expect(
        formatLogEntries([
          {
            metadata: { timestamp: 't', severity: 'ERROR' },
            data: {
              msg: 'Cron job "report" failed',
              error: { name: 'Error', message: 'no database', stack: 's' },
            },
          },
        ]),
      ).toBe('[t] ERROR: Cron job "report" failed: no database');
    });

    it("should add pino's err message and an error given as text", () => {
      expect(
        formatLogEntries([
          { metadata: {}, data: { msg: 'a', err: { message: 'b' } } },
          { metadata: {}, data: { msg: 'c', error: 'd' } },
        ]),
      ).toBe('[] INFO: a: b\n[] INFO: c: d');
    });

    it('should not repeat a message the line already is', () => {
      expect(
        formatLogEntries([
          { metadata: {}, data: { msg: 'boom', error: { message: 'boom' } } },
        ]),
      ).toBe('[] INFO: boom');
    });
  });

  describe('Times', () => {
    it('should show a Date in UTC, without the local time zone text', () => {
      expect(
        formatLogEntries([
          {
            metadata: {
              timestamp: new Date('2026-11-22T11:44:19.812Z'),
              severity: 'INFO',
            },
            data: 'Starting',
          },
        ]),
      ).toBe('[2026-11-22 11:44:19.812] INFO: Starting');
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
