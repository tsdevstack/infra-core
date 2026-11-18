/**
 * Build the Terraform value of an Azure name that is unique worldwide
 */

import type { AzureInfraConfig } from '../../types/config.ts';
import {
  buildAzureResourceName,
  type AzureUniqueResource,
} from './build-azure-resource-name.ts';

/**
 * A legacy environment's generated Terraform stays byte-identical: it keeps
 * the expression it always had (e.g. `"${var.project_name}-${var.environment}-kong"`).
 * The unique scheme writes the full name (buildAzureResourceName).
 *
 * @param config - The environment's Azure config
 * @param resource - Which resource
 * @param legacyValue - The Terraform value a legacy environment has, quotes included
 * @param app - The App Service's app (`kong` or the Next.js service)
 * @returns The Terraform value, quotes included
 */
export function buildAzureTerraformName(
  config: Pick<
    AzureInfraConfig,
    'projectName' | 'environment' | 'naming' | 'subscriptionId'
  >,
  resource: AzureUniqueResource,
  legacyValue: string,
  app?: string,
): string {
  if (config.naming === 'legacy') {
    return legacyValue;
  }
  return `"${buildAzureResourceName(resource, {
    projectName: config.projectName,
    environment: config.environment,
    naming: config.naming,
    subscriptionId: config.subscriptionId,
    app,
  })}"`;
}
