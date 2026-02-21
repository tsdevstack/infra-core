/**
 * Extract lock ID from terraform state lock error output
 */

/**
 * Extracts the lock ID from terraform error output containing state lock info.
 *
 * Looks for patterns like:
 *   Lock Info:
 *     ID:        c7ea14eb-66e6-4f5e-3ee5-23bb545614f5
 *
 * @param output - The terraform output/error text
 * @returns The lock ID if found, undefined otherwise
 */
export function extractLockId(output: string): string | undefined {
  // Match the ID line in Lock Info section
  // Format: "ID:        <uuid>"
  const match = output.match(/ID:\s+([a-f0-9-]{36})/i);
  return match?.[1];
}
