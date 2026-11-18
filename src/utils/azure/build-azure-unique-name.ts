/**
 * Build an Azure name that must be unique worldwide
 */

import { createHash } from 'node:crypto';
import { AZURE_NAME_HASH_LENGTH } from '../../constants/resource-naming.ts';
import type { NamingScheme } from '../../types/config.ts';
import { buildAccountSuffix } from '../naming/build-account-suffix.ts';

/**
 * A legacy environment keeps its name exactly (`base`). The unique scheme
 * adds the subscription's account suffix (`{base}-{suffix}`, or
 * `{base}{suffix}` where only letters and digits are allowed). A name longer
 * than the resource allows becomes a trimmed prefix plus a hash of the full
 * name, so it stays unique and is the same wherever it is computed.
 *
 * @param options.base - The name a legacy environment has
 * @param options.naming - The environment's naming scheme
 * @param options.subscriptionId - The environment's Azure subscription ID
 * @param options.maxLength - Microsoft's longest name for the resource
 * @param options.alphanumeric - True when the resource takes no hyphens
 * @returns The resource name
 */
export function buildAzureUniqueName(options: {
  base: string;
  naming: NamingScheme;
  subscriptionId: string;
  maxLength: number;
  alphanumeric?: boolean;
}): string {
  const { base, naming, subscriptionId, maxLength, alphanumeric } = options;

  if (naming === 'legacy') {
    return base;
  }

  const separator = alphanumeric ? '' : '-';
  const cleanBase = alphanumeric ? base.replace(/[^a-z0-9]/g, '') : base;
  const name = `${cleanBase}${separator}${buildAccountSuffix(subscriptionId)}`;
  if (name.length <= maxLength) {
    return name;
  }

  const hash = createHash('sha256')
    .update(name)
    .digest('hex')
    .slice(0, AZURE_NAME_HASH_LENGTH);
  const prefix = name
    .slice(0, maxLength - AZURE_NAME_HASH_LENGTH - separator.length)
    .replace(/-+$/, '');
  return `${prefix}${separator}${hash}`;
}
