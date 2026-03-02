/**
 * infra-core — Shared Infrastructure Engine
 *
 * Standalone package for Terraform generation and deployment logic.
 * Consumed by tsdevstack cli-infra, the simpler deployment framework,
 * and the cloud platform.
 *
 * Zero dependencies on cli-core. Adapters translate their config
 * format into InfraConfig and inject runtime services.
 */

// Config types
export type {
  DatabaseConfig,
  RedisConfig,
  ServiceDatabaseInfo,
  ServiceConfig,
  FrontendConfig,
  SPAConfig,
  WorkerConfig,
  ScheduledJobConfig,
  FrontendHostingType,
  WafRateLimitConfig,
  GcpWafCustomRule,
  AwsWafByteMatchConfig,
  AwsWafGeoMatchConfig,
  AwsWafCustomRule,
  WafConfig,
  BaseInfraConfig,
  AzureInfraConfig,
  AWSInfraConfig,
  GCPInfraConfig,
  InfraConfig,
} from './types/index.ts';

// Runtime types
export type {
  InfraCoreLogger,
  ExecuteCommandOptions,
  InfraCoreRuntime,
} from './types/index.ts';

// Credential types
export type {
  CloudProvider,
  GCPCredentials,
  GCPClientOptions,
  AWSCredentials,
  AzureCredentials,
} from './types/index.ts';

// Runtime implementations
export { defaultLogger } from './runtime/index.ts';
export { InfraCoreError } from './runtime/index.ts';

// Provider-specific generators (namespaced to avoid name collisions)
export * as azure from './generators/azure/index.ts';
export * as gcp from './generators/gcp/index.ts';
export * as aws from './generators/aws/index.ts';

// TF utilities (from Phase 25b)
export {
  toTerraformId,
  toTfVarSuffix,
  escapeHcl,
} from './utils/terraform/index.ts';
export { toDnsAuthName } from './utils/gcp/to-dns-auth-name.ts';

// GCP utilities
export { buildGCPClientOptions } from './utils/gcp/build-gcp-client-options.ts';

// Terraform execution (from Phase 25c)
export {
  executeTerraform,
  checkTerraformInstalled,
  getTerraformOutput,
  getTerraformOutputJson,
  extractLockId,
  extractImportTargets,
  detectRouteAssociationError,
} from './terraform/index.ts';
export type {
  TerraformCommand,
  TerraformExecuteOptions,
  TerraformResult,
  ImportTarget,
} from './terraform/index.ts';

// Provider-specific terraform env builders (aliased to avoid name collisions)
export { buildTerraformEnv as buildGcpTerraformEnv } from './terraform/gcp/build-terraform-env.ts';
export { buildTerraformEnv as buildAwsTerraformEnv } from './terraform/aws/build-terraform-env.ts';
export { buildTerraformEnv as buildAzureTerraformEnv } from './terraform/azure/build-terraform-env.ts';

// Deploy: provider-specific deployment utilities (from Phase 25c Session 2)
// Namespaced exports for organized access
export * as deployGcp from './deploy/gcp/index.ts';
export * as deployAws from './deploy/aws/index.ts';
export * as deployAzure from './deploy/azure/index.ts';

// Deploy: individual function exports
// AWS
export { configureEcrAuth } from './deploy/aws/ecr/configure-ecr-auth.ts';
export { pushImage } from './deploy/aws/ecr/push-image.ts';
export type { PushImageResult } from './deploy/aws/ecr/push-image.ts';
export { uploadSpaToS3 } from './deploy/aws/upload-spa-to-s3.ts';
export type {
  UploadSpaToS3Options,
  UploadSpaToS3Result,
} from './deploy/aws/upload-spa-to-s3.ts';
export { invalidateCloudfront } from './deploy/aws/invalidate-cloudfront.ts';
export type {
  InvalidateCloudfrontOptions,
  InvalidateCloudfrontResult,
} from './deploy/aws/invalidate-cloudfront.ts';
// Azure
export { configureAcrAuth } from './deploy/azure/acr/configure-acr-auth.ts';
export { getAcrRefreshToken } from './deploy/azure/acr/get-acr-refresh-token.ts';
export { uploadSpaToAzureStorage } from './deploy/azure/upload-spa-to-azure-storage.ts';
export type {
  UploadSpaToAzureStorageOptions,
  UploadSpaToAzureStorageResult,
} from './deploy/azure/upload-spa-to-azure-storage.ts';
// GCP
export { configureDockerAuth } from './deploy/gcp/configure-docker-auth.ts';
export { waitForImage } from './deploy/gcp/wait-for-image.ts';
export type { WaitForImageOptions } from './deploy/gcp/wait-for-image.ts';
export { parseImageUri } from './deploy/gcp/parse-image-uri.ts';
export type { ImageUriComponents } from './deploy/gcp/parse-image-uri.ts';
export { uploadSpaToCloudStorage } from './deploy/gcp/upload-spa-to-cloud-storage.ts';
export type {
  UploadSpaOptions,
  UploadSpaResult,
} from './deploy/gcp/upload-spa-to-cloud-storage.ts';

// Deploy: service deployment functions
// AWS ECS
export { deployEcsServiceWithSecrets } from './deploy/aws/ecs/deploy-ecs-service-with-secrets.ts';
export type {
  DeployEcsServiceWithSecretsOptions,
  DeployEcsServiceWithSecretsResult,
} from './deploy/aws/ecs/deploy-ecs-service-with-secrets.ts';
export { updateEcsService } from './deploy/aws/ecs/update-ecs-service.ts';
export type {
  UpdateEcsServiceOptions,
  UpdateEcsServiceResult,
} from './deploy/aws/ecs/update-ecs-service.ts';
export { executeEcsTask } from './deploy/aws/ecs/execute-ecs-task.ts';
export type {
  EcsTaskOptions,
  EcsTaskResult,
} from './deploy/aws/ecs/execute-ecs-task.ts';
export { waitForEcsStable } from './deploy/aws/ecs/wait-for-ecs-stable.ts';
export type {
  WaitForEcsStableOptions,
  WaitForEcsStableResult,
} from './deploy/aws/ecs/wait-for-ecs-stable.ts';
export { deleteEcsService } from './deploy/aws/ecs/delete-ecs-service.ts';
export type {
  DeleteEcsServiceOptions,
  DeleteEcsServiceResult,
} from './deploy/aws/ecs/delete-ecs-service.ts';
// AWS App Runner
export { createOrUpdateAppRunnerService } from './deploy/aws/apprunner/create-or-update-apprunner-service.ts';
export type {
  CreateOrUpdateAppRunnerServiceOptions,
  CreateOrUpdateAppRunnerServiceResult,
} from './deploy/aws/apprunner/create-or-update-apprunner-service.ts';
export { waitForAppRunnerRunning } from './deploy/aws/apprunner/wait-for-apprunner-running.ts';
export type {
  WaitForAppRunnerRunningOptions,
  WaitForAppRunnerRunningResult,
} from './deploy/aws/apprunner/wait-for-apprunner-running.ts';
// Azure credential + Container Apps
export { createAzureCredential } from './deploy/azure/create-azure-credential.ts';
export { createOrUpdateContainerApp } from './deploy/azure/container-apps/create-or-update-container-app.ts';
export type {
  CreateOrUpdateContainerAppOptions,
  CreateOrUpdateContainerAppResult,
} from './deploy/azure/container-apps/create-or-update-container-app.ts';
export { waitForContainerAppReady } from './deploy/azure/container-apps/wait-for-container-app-ready.ts';
export type {
  WaitForContainerAppReadyOptions,
  WaitForContainerAppReadyResult,
} from './deploy/azure/container-apps/wait-for-container-app-ready.ts';
// GCP Cloud Run
export { deployCloudRunService } from './deploy/gcp/cloud-run-services.ts';
export type {
  CloudRunServiceOptions,
  CloudRunServiceResult,
} from './deploy/gcp/cloud-run-services.ts';
export { executeCloudRunJob } from './deploy/gcp/cloud-run-jobs.ts';
export type {
  CloudRunJobOptions,
  CloudRunJobResult,
} from './deploy/gcp/cloud-run-jobs.ts';
export { setServiceInvokerPolicy } from './deploy/gcp/set-service-invoker-policy.ts';
export type { SetServiceInvokerPolicyOptions } from './deploy/gcp/set-service-invoker-policy.ts';
export { setSchedulerInvokerBindings } from './deploy/gcp/set-scheduler-invoker-bindings.ts';
export type { SetSchedulerInvokerBindingsOptions } from './deploy/gcp/set-scheduler-invoker-bindings.ts';
export { fetchJobLogs } from './deploy/gcp/fetch-cloud-run-logs.ts';
export { formatLogEntries } from './deploy/gcp/format-log-entries.ts';
export type { LogEntry } from './deploy/gcp/format-log-entries.ts';

// Deploy: shared utilities (Session 2)
export { getAllFiles, getMimeType, getCacheControl } from './utils/fs/index.ts';
export { sleep } from './utils/async/sleep.ts';

// Deploy: shared deployment utilities (Session 4)
export * as deployShared from './deploy/shared/index.ts';
// Pool calculation
export { calculatePoolSize } from './deploy/shared/calculate-pool-size.ts';
export { isPoolRelevant } from './deploy/shared/is-pool-relevant.ts';
export { getTotalServiceMaxInstances } from './deploy/shared/get-total-service-max-instances.ts';
export { getTotalWorkerMaxInstances } from './deploy/shared/get-total-worker-max-instances.ts';
export { checkTopologyDrift } from './deploy/shared/check-topology-drift.ts';
// Env var and secrets builders
export { buildBackendEnvVars } from './deploy/shared/build-backend-env-vars.ts';
export { buildBackendSecrets } from './deploy/shared/build-backend-secrets.ts';
export { buildFrontendEnvVars } from './deploy/shared/build-frontend-env-vars.ts';
export { buildFrontendSecrets } from './deploy/shared/build-frontend-secrets.ts';
export { parseServiceFilter } from './deploy/shared/parse-service-filter.ts';
export type { SecretConfig, BuildSecretNameFn } from './deploy/shared/types.ts';
// Credential name utilities
export { toEnvVarPrefix } from './utils/credentials/to-env-var-prefix.ts';
export { toServiceEnvVarName } from './utils/credentials/to-service-env-var-name.ts';
export { fromServiceEnvVarName } from './utils/credentials/from-service-env-var-name.ts';

// Constants
export { MIME_TYPES } from './constants/index.ts';
export {
  GCP_DATABASE_CONNECTION_LIMITS,
  DEFAULT_DATABASE_TIER,
  AWS_DATABASE_CONNECTION_LIMITS,
  DEFAULT_AWS_DATABASE_TIER,
  AZURE_DATABASE_CONNECTION_LIMITS,
  DEFAULT_AZURE_DATABASE_TIER,
} from './constants/index.ts';
