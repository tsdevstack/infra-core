/**
 * Azure deployment utilities
 */

// Types
export type { ContainerAppIdentity } from './types/index.ts';

export { configureAcrAuth } from './acr/configure-acr-auth.ts';
export { getAcrRefreshToken } from './acr/get-acr-refresh-token.ts';
export { buildAcrAuthConfig } from './acr/build-acr-auth-config.ts';
export type {
  AcrAuthConfig,
  BuildAcrAuthConfigOptions,
} from './acr/build-acr-auth-config.ts';
export { uploadSpaToAzureStorage } from './upload-spa-to-azure-storage.ts';
export type {
  UploadSpaToAzureStorageOptions,
  UploadSpaToAzureStorageResult,
} from './upload-spa-to-azure-storage.ts';

// Azure credential (Session 3)
export { createAzureCredential } from './create-azure-credential.ts';

// Container Apps (Session 3)
export { createOrUpdateContainerApp } from './container-apps/create-or-update-container-app.ts';
export type {
  CreateOrUpdateContainerAppOptions,
  CreateOrUpdateContainerAppResult,
} from './container-apps/create-or-update-container-app.ts';
export { waitForContainerAppReady } from './container-apps/wait-for-container-app-ready.ts';
export type {
  WaitForContainerAppReadyOptions,
  WaitForContainerAppReadyResult,
} from './container-apps/wait-for-container-app-ready.ts';
export { waitForContainerAppActivation } from './container-apps/wait-for-container-app-activation.ts';
export type {
  WaitForContainerAppActivationOptions,
  WaitForContainerAppActivationResult,
} from './container-apps/wait-for-container-app-activation.ts';
export { deployWithActivationCheck } from './container-apps/deploy-with-activation-check.ts';
export type {
  DeployWithActivationCheckOptions,
  DeployWithActivationCheckResult,
} from './container-apps/deploy-with-activation-check.ts';
