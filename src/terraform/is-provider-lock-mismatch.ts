/**
 * Detect a provider version that the lock file holds back
 */

import { stripVTControlCharacters } from 'node:util';

/**
 * True when `terraform init` failed because .terraform.lock.hcl locks a
 * provider version outside the configured constraint. Terraform then asks
 * for `init -upgrade`; the CLI only does that when the user asks for it.
 *
 * Terraform wraps long error lines inside its "│" box, so the output is
 * flattened before matching.
 *
 * @param output - Combined stdout and stderr of `terraform init`
 */
export function isProviderLockMismatch(output: string): boolean {
  const flat = stripVTControlCharacters(output)
    .replace(/[│╷╵]/g, ' ')
    .replace(/\s+/g, ' ');
  return /locked provider \S+ \S+ does not match configured version constraint/.test(
    flat,
  );
}
