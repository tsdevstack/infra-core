/**
 * Build the account suffix for names that must be unique worldwide
 */

import { createHash } from 'node:crypto';
import { ACCOUNT_SUFFIX_LENGTH } from '../../constants/resource-naming.ts';

/**
 * A short, stable suffix for one cloud account (GCP project ID, Azure
 * subscription ID): the first characters of the SHA-256 of the ID, in
 * lowercase hex, so it fits every cloud's name rules (Azure storage
 * accounts take only lowercase letters and digits).
 *
 * Two projects with the same name in different accounts get different
 * names; the same account always gets the same suffix.
 *
 * @param accountId - GCP project ID or Azure subscription ID
 * @returns The suffix, without a separator
 */
export function buildAccountSuffix(accountId: string): string {
  return createHash('sha256')
    .update(accountId)
    .digest('hex')
    .slice(0, ACCOUNT_SUFFIX_LENGTH);
}
