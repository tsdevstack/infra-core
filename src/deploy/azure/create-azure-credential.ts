/**
 * Create Azure credential for SDK authentication
 *
 * Supports two modes:
 * - CI (OIDC): DefaultAzureCredential picks up azure/login session
 * - Local: ClientSecretCredential with explicit credentials
 */

import {
  ClientSecretCredential,
  DefaultAzureCredential,
} from '@azure/identity';
import type { TokenCredential } from '@azure/identity';
import type { InfraCoreRuntime } from '../../types/runtime.ts';
import { InfraCoreError } from '../../runtime/infra-core-error.ts';
import type { AzureCredentials } from '../../types/credentials.ts';

export function createAzureCredential(
  runtime: InfraCoreRuntime,
  credentials: AzureCredentials,
): TokenCredential {
  if (runtime.isCIEnv()) {
    return new DefaultAzureCredential();
  }

  if (!credentials.clientSecret) {
    throw new InfraCoreError(
      'Azure client secret is required for local development',
      'credentials',
      'Ensure clientSecret is set in .tsdevstack/.credentials.azure.json',
    );
  }

  return new ClientSecretCredential(
    credentials.tenantId,
    credentials.clientId,
    credentials.clientSecret,
  );
}
