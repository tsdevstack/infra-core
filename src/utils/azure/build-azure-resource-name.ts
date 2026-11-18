/**
 * Build the name of an Azure resource whose name is unique worldwide
 */

import { AZURE_NAME_MAX_LENGTH } from '../../constants/resource-naming.ts';
import type { NamingScheme } from '../../types/config.ts';
import { buildAzureUniqueName } from './build-azure-unique-name.ts';

export type AzureUniqueResource =
  | 'stateStorageAccount'
  | 'blobStorageAccount'
  | 'dbExportsStorageAccount'
  | 'containerRegistry'
  | 'appService'
  | 'redis'
  | 'postgresServer';

/**
 * The one place each of these names is built, for Terraform and the CLI's
 * SDK calls alike. Legacy environments get the names they were deployed
 * with; the unique scheme adds the subscription's suffix
 * (buildAzureUniqueName).
 *
 * - stateStorageAccount: `{project}{env}tfstate` (Terraform's state);
 *   unique scheme `{project}{env}tf{suffix}`, short enough to stay readable
 *   within 24 characters
 * - blobStorageAccount: `{project}{env}storage` (storage buckets); unique
 *   scheme `{project}{env}st{suffix}`
 * - dbExportsStorageAccount: `{project}{env}dbx{suffix}` (saved databases),
 *   in every environment: it is new, so no legacy name to keep
 * - containerRegistry: `{project}{env}acr`
 * - appService: `{project}-{env}-{app}` (Kong, each Next.js app)
 * - redis: `{project}-{env}-redis`
 * - postgresServer: `{project}-{env}-postgres`
 *
 * @param resource - Which resource
 * @param options.app - The App Service's app (`kong` or the Next.js service)
 * @returns The resource name
 */
export function buildAzureResourceName(
  resource: AzureUniqueResource,
  options: {
    projectName: string;
    environment: string;
    naming: NamingScheme;
    subscriptionId: string;
    app?: string;
  },
): string {
  const { projectName, environment, naming, subscriptionId } = options;
  const compactProject = projectName.replace(/[^a-z0-9]/g, '');
  const common = { naming, subscriptionId };

  switch (resource) {
    case 'stateStorageAccount':
      return naming === 'legacy'
        ? `${compactProject}${environment}tfstate`
        : buildAzureUniqueName({
            ...common,
            base: `${compactProject}${environment}tf`,
            maxLength: AZURE_NAME_MAX_LENGTH.storageAccount,
            alphanumeric: true,
          });
    case 'blobStorageAccount':
      return naming === 'legacy'
        ? `${compactProject}${environment}storage`
        : buildAzureUniqueName({
            ...common,
            base: `${compactProject}${environment}st`,
            maxLength: AZURE_NAME_MAX_LENGTH.storageAccount,
            alphanumeric: true,
          });
    case 'dbExportsStorageAccount':
      return buildAzureUniqueName({
        ...common,
        naming: 'unique',
        base: `${compactProject}${environment}dbx`,
        maxLength: AZURE_NAME_MAX_LENGTH.storageAccount,
        alphanumeric: true,
      });
    case 'containerRegistry':
      return buildAzureUniqueName({
        ...common,
        base: `${projectName.replace(/-/g, '')}${environment}acr`,
        maxLength: AZURE_NAME_MAX_LENGTH.containerRegistry,
        alphanumeric: true,
      });
    case 'appService':
      return buildAzureUniqueName({
        ...common,
        base: `${projectName}-${environment}-${options.app ?? ''}`,
        maxLength: AZURE_NAME_MAX_LENGTH.appService,
      });
    case 'redis':
      return buildAzureUniqueName({
        ...common,
        base: `${projectName}-${environment}-redis`,
        maxLength: AZURE_NAME_MAX_LENGTH.redis,
      });
    case 'postgresServer':
      return buildAzureUniqueName({
        ...common,
        base: `${projectName}-${environment}-postgres`,
        maxLength: AZURE_NAME_MAX_LENGTH.postgresServer,
      });
  }
}
