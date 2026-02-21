/**
 * Format Cloud Logging entries for display
 *
 * Converts log entries from Cloud Logging API into a readable string format.
 */

export interface LogEntry {
  metadata?: { timestamp?: string; severity?: string };
  data?: string | { message?: string };
}

/**
 * Format log entries for display
 */
export function formatLogEntries(entries: unknown[]): string {
  const logs: string[] = [];

  for (const entry of entries) {
    const e = entry as LogEntry;

    const timestamp = e.metadata?.timestamp || '';
    const severity = e.metadata?.severity || 'INFO';
    const message =
      typeof e.data === 'string'
        ? e.data
        : e.data?.message || JSON.stringify(e.data);

    logs.push(`[${timestamp}] ${severity}: ${message}`);
  }

  return logs.join('\n');
}
