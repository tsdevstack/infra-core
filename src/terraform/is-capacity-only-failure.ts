/**
 * Detect a Terraform run that failed only for lack of cloud capacity
 */

import type { CloudProvider } from '../types/credentials.ts';
import { CLOUD_CAPACITY_ERROR_PATTERNS } from '../constants/cloud-capacity-errors.ts';

/**
 * True when the output has at least one error and every error is a capacity
 * shortage (CLOUD_CAPACITY_ERROR_PATTERNS). Any other error would fail the
 * same way on a retry, so the result is then false.
 *
 * Terraform starts each error on its own line with "Error: " (after the "│ "
 * frame in the default output); the text up to the next error belongs to it.
 *
 * @param output - Combined stdout and stderr of the Terraform run
 * @param provider - Cloud provider the run targeted
 * @returns true if every error is a capacity shortage
 */
export function isCapacityOnlyFailure(
  output: string,
  provider: CloudProvider,
): boolean {
  const errors = output.split(/^[│\s]*Error: /m).slice(1);
  if (errors.length === 0) return false;

  const patterns = CLOUD_CAPACITY_ERROR_PATTERNS[provider];
  return errors.every((error) =>
    patterns.some((pattern) => pattern.test(error)),
  );
}
