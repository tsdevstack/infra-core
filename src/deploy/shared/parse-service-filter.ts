/**
 * Parse Service Filter
 *
 * Parses a comma-separated service filter string into an array of service names.
 * Returns undefined when no filter is provided (meaning "deploy all").
 */

export function parseServiceFilter(
  service: string | undefined,
): string[] | undefined {
  if (!service) {
    return undefined;
  }

  const names = service
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  return names.length > 0 ? names : undefined;
}
