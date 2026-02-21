/**
 * Build GCP client options from credentials
 *
 * Supports two modes:
 * - Explicit credentials (local): Includes credentials object
 * - ADC (CI with WIF): Only projectId, SDK auto-discovers credentials
 */

import type {
  GCPCredentials,
  GCPClientOptions,
} from '../../types/credentials.ts';

export function buildGCPClientOptions(
  credentials: GCPCredentials,
): GCPClientOptions {
  const options: GCPClientOptions = {
    projectId: credentials.project_id,
  };

  // Only pass explicit credentials if we have a private key (not ADC mode)
  if (credentials.private_key) {
    options.credentials = {
      client_email: credentials.client_email,
      private_key: credentials.private_key,
    };
  }

  return options;
}
