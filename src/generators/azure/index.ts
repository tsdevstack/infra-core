/**
 * Azure Terraform file generators
 */

export { generateMainTf } from './generate-main-tf.ts';
export { generateVariablesTf } from './generate-variables-tf.ts';
export { generateTfvars } from './generate-tfvars.ts';
export { generateOutputsTf } from './generate-outputs-tf.ts';
export { generateNetworkTf } from './generate-network-tf.ts';
export { generateAcrTf } from './generate-acr-tf.ts';
export { generateContainerAppsEnvTf } from './generate-container-apps-env-tf.ts';
export { generateContainerAppsIdentityTf } from './generate-container-apps-identity-tf.ts';
export { generateDatabaseTf } from './generate-database-tf.ts';
export { generateRedisTf } from './generate-redis-tf.ts';
export { generateFrontdoorTf } from './generate-frontdoor-tf.ts';
export {
  generateSpaStorageTf,
  buildSpaStorageAccountName,
} from './generate-spa-storage-tf.ts';
export { generateDnsTf } from './generate-dns-tf.ts';
export { generateWafTf } from './generate-waf-tf.ts';
export { generateWafCustomRules } from './generate-waf-custom-rules.ts';
export { generateAppServiceTf } from './generate-app-service-tf.ts';
export { generateDiagnosticsTf } from './generate-diagnostics-tf.ts';
export { generateScheduledJobsTf } from './generate-scheduled-jobs-tf.ts';
