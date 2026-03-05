/**
 * Azure deployment utilities
 */

export { configureAcrAuth } from './acr/configure-acr-auth.ts';
export { getAcrRefreshToken } from './acr/get-acr-refresh-token.ts';
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
