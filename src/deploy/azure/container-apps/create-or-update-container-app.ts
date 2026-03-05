/**
 * Create or Update Container App
 *
 * Creates or updates an Azure Container App with a new image, environment variables, and secrets.
 */

import { ContainerAppsAPIClient } from '@azure/arm-appcontainers';
import { createAzureCredential } from '../create-azure-credential.ts';
import { getAcrRefreshToken } from '../acr/get-acr-refresh-token.ts';
import type { Container } from '@azure/arm-appcontainers';
import type { InfraCoreRuntime } from '../../../types/runtime.ts';
import type { AzureCredentials } from '../../../types/credentials.ts';
import { InfraCoreError } from '../../../runtime/infra-core-error.ts';

export interface CreateOrUpdateContainerAppOptions {
  credentials: AzureCredentials;
  resourceGroupName: string;
  containerAppName: string;
  containerAppsEnvId: string;
  image: string;
  /** Environment variables as key-value pairs */
  envVars?: Array<{ name: string; value: string }>;
  /** Secrets to inject (name + secretRef for Key Vault reference, or name + value for inline) */
  secrets?: Array<{ name: string; value: string }>;
  /** Secret env var refs (env var name -> secret name) */
  secretEnvVars?: Array<{ name: string; secretRef: string }>;
  /** Container command override */
  command?: string[];
  /** Port for ingress (undefined = no ingress) */
  ingressPort?: number;
  /** Min replicas (default: 0) */
  minReplicas?: number;
  /** Max replicas (default: 10) */
  maxReplicas?: number;
  /** CPU cores (default: 0.25) */
  cpu?: number;
  /** Memory in Gi (default: '0.5Gi') */
  memory?: string;
  /** Whether ingress is external (default: false = internal only) */
  externalIngress?: boolean;
  /** ACR login server for private registry auth (e.g., 'myacr.azurecr.io') */
  acrLoginServer?: string;
  /** User-assigned managed identity resource ID for ACR pull (preferred over password auth) */
  acrManagedIdentityId?: string;
}

export interface CreateOrUpdateContainerAppResult {
  fqdn?: string;
}

export async function createOrUpdateContainerApp(
  runtime: InfraCoreRuntime,
  options: CreateOrUpdateContainerAppOptions,
): Promise<CreateOrUpdateContainerAppResult> {
  const {
    credentials,
    resourceGroupName,
    containerAppName,
    containerAppsEnvId,
    image,
    envVars = [],
    secrets = [],
    secretEnvVars = [],
    command,
    ingressPort,
    minReplicas = 0,
    maxReplicas = 10,
    cpu = 0.25,
    memory = '0.5Gi',
    externalIngress = false,
    acrLoginServer,
    acrManagedIdentityId,
  } = options;

  const credential = createAzureCredential(runtime, credentials);

  const client = new ContainerAppsAPIClient(
    credential,
    credentials.subscriptionId,
  );

  // Build environment variables: plain env vars + secret references
  const allEnvVars = [
    ...envVars.map((e) => ({ name: e.name, value: e.value })),
    ...secretEnvVars.map((e) => ({ name: e.name, secretRef: e.secretRef })),
  ];

  // Build container definition
  const containerDef: Container = {
    name: containerAppName,
    image,
    resources: { cpu, memory },
    env: allEnvVars.length > 0 ? allEnvVars : undefined,
    command: command && command.length > 0 ? command : undefined,
  };

  // Build ingress config
  const ingress = ingressPort
    ? {
        external: externalIngress,
        targetPort: ingressPort,
        transport: 'auto' as const,
      }
    : undefined;

  // Build secrets config for Container App
  const allSecrets = secrets.map((s) => ({ name: s.name, value: s.value }));

  // ACR registry auth: prefer managed identity, fall back to password
  let registries: Array<Record<string, string>> | undefined;
  let identity:
    | {
        type: string;
        userAssignedIdentities?: Record<string, Record<string, never>>;
      }
    | undefined;

  if (acrLoginServer && acrManagedIdentityId) {
    // Managed identity — no tokens to expire, works with scale-to-zero
    registries = [{ server: acrLoginServer, identity: acrManagedIdentityId }];
    identity = {
      type: 'UserAssigned',
      userAssignedIdentities: { [acrManagedIdentityId]: {} },
    };
  } else if (acrLoginServer) {
    // Fallback: password-based auth (short-lived tokens)
    // Local: SP client secret as password
    // CI: exchange OIDC token for ACR refresh token
    let acrUsername: string;
    if (credentials.clientSecret) {
      allSecrets.push({
        name: 'acr-password',
        value: credentials.clientSecret,
      });
      acrUsername = credentials.clientId;
    } else {
      const refreshToken = await getAcrRefreshToken(acrLoginServer);
      allSecrets.push({
        name: 'acr-password',
        value: refreshToken,
      });
      acrUsername = '00000000-0000-0000-0000-000000000000';
    }
    registries = [
      {
        server: acrLoginServer,
        username: acrUsername,
        passwordSecretRef: 'acr-password',
      },
    ];
  }

  const secretsConfig = allSecrets.length > 0 ? allSecrets : undefined;

  try {
    const result = await client.containerApps.beginCreateOrUpdateAndWait(
      resourceGroupName,
      containerAppName,
      {
        location: credentials.location,
        environmentId: containerAppsEnvId,
        identity,
        configuration: {
          ingress,
          secrets: secretsConfig,
          registries,
        },
        template: {
          containers: [containerDef],
          scale: {
            minReplicas,
            maxReplicas,
            cooldownPeriod: 900,
            rules: ingressPort
              ? [
                  {
                    name: 'http-scaling',
                    http: {
                      metadata: { concurrentRequests: '10' },
                    },
                  },
                ]
              : undefined,
          },
        },
      },
    );

    return {
      fqdn: result.configuration?.ingress?.fqdn,
    };
  } catch (err: unknown) {
    throw new InfraCoreError(
      'Failed to create or update Container App',
      'container-app-deploy',
      err instanceof Error ? err.message : 'Unknown error',
    );
  }
}
