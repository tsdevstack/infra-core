/**
 * Format Cloud Logging entries for display
 *
 * Converts log entries from Cloud Logging API into a readable string format
 * (a failed migration or database setup job's lines; times in UTC).
 */

/** An error as a JSON log line carries it */
interface LoggedError {
  message?: string;
}

export interface LogEntry {
  /** The client hands the time over as a Date; a string is shown as it is */
  metadata?: { timestamp?: string | Date; severity?: string };
  /**
   * Plain text, or a JSON line: pino writes msg, others message. The
   * backend logger puts an error under error, pino's own serializer
   * under err.
   */
  data?:
    | string
    | {
        msg?: string;
        message?: string;
        error?: LoggedError | string;
        err?: LoggedError;
      };
}

/**
 * Format log entries for display
 */
export function formatLogEntries(entries: unknown[]): string {
  const logs: string[] = [];

  for (const entry of entries) {
    const e = entry as LogEntry;

    // UTC, as infra:logs shows it: 2026-10-30 12:00:00.123
    const rawTime = e.metadata?.timestamp;
    const timestamp =
      rawTime instanceof Date
        ? rawTime.toISOString().replace('T', ' ').replace(/Z$/, '')
        : rawTime || '';
    const severity = e.metadata?.severity || 'INFO';
    const text =
      typeof e.data === 'string'
        ? e.data
        : e.data?.msg || e.data?.message || JSON.stringify(e.data);

    // An error line also shows the error's own message, the reason it failed
    const cause =
      typeof e.data === 'object' ? (e.data.error ?? e.data.err) : undefined;
    const causeMessage = typeof cause === 'string' ? cause : cause?.message;
    const message =
      causeMessage && causeMessage !== text ? `${text}: ${causeMessage}` : text;

    logs.push(`[${timestamp}] ${severity}: ${message}`);
  }

  return logs.join('\n');
}
