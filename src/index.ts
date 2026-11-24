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
  ScheduledJobBase,
  TriggerJobConfig,
  CronJobConfig,
  FrontendHostingType,
  WafRateLimitConfig,
  GcpWafCustomRule,
  AwsWafByteMatchConfig,
  AwsWafGeoMatchConfig,
  AwsWafCustomRule,
  WafConfig,
  BaseInfraConfig,
  AzureInfraConfig,
  AppServicePlanScaling,
  AWSInfraConfig,
  AwsCronJobTfConfig,
  GCPInfraConfig,
  InfraConfig,
  NamingScheme,
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

// Generators shared by every provider
export {
  generateDbInit,
  type DbInitCloud,
  type DbInitFiles,
  type GenerateDbInitOptions,
} from './generators/shared/generate-db-init.ts';

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
export { buildGcpCloudRunName } from './utils/gcp/build-gcp-cloud-run-name.ts';
export { buildGcpSchedulerAccountEmail } from './utils/gcp/build-gcp-scheduler-account-email.ts';
export { isCronJob } from './utils/scheduled-jobs/is-cron-job.ts';
export { isTriggerJob } from './utils/scheduled-jobs/is-trigger-job.ts';
export { buildGcsStorageBucketName } from './utils/gcp/build-gcs-storage-bucket-name.ts';
export { buildAzureStorageContainerName } from './utils/azure/build-azure-storage-container-name.ts';
export { buildS3StorageBucketName } from './utils/aws/build-s3-storage-bucket-name.ts';
export { buildAccountSuffix } from './utils/naming/build-account-suffix.ts';
export { buildAzureUniqueName } from './utils/azure/build-azure-unique-name.ts';
export { buildAzureResourceName } from './utils/azure/build-azure-resource-name.ts';
export type { AzureUniqueResource } from './utils/azure/build-azure-resource-name.ts';

// Terraform execution (from Phase 25c)
export {
  executeTerraform,
  checkTerraformInstalled,
  getTerraformOutput,
  getTerraformOutputJson,
  extractLockId,
  extractImportTargets,
  detectRouteAssociationError,
  isCapacityOnlyFailure,
  extractCnameConflicts,
} from './terraform/index.ts';
export type {
  TerraformCommand,
  TerraformExecuteOptions,
  TerraformResult,
  ImportTarget,
  CnameConflictTarget,
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
export { readEcsTaskOutcome } from './deploy/aws/ecs/read-ecs-task-outcome.ts';
export { registerEcsTaskDefinitionRevision } from './deploy/aws/ecs/register-ecs-task-definition-revision.ts';
export { runEcsTaskAndWait } from './deploy/aws/ecs/run-ecs-task-and-wait.ts';
export type { EcsTaskOutcome } from './deploy/aws/ecs/read-ecs-task-outcome.ts';
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
// Azure types
export type { ContainerAppIdentity } from './deploy/azure/types/index.ts';
// Azure ACR auth
export { buildAcrAuthConfig } from './deploy/azure/acr/build-acr-auth-config.ts';
export type {
  AcrAuthConfig,
  BuildAcrAuthConfigOptions,
} from './deploy/azure/acr/build-acr-auth-config.ts';
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
export { waitForContainerAppActivation } from './deploy/azure/container-apps/wait-for-container-app-activation.ts';
export type {
  WaitForContainerAppActivationOptions,
  WaitForContainerAppActivationResult,
} from './deploy/azure/container-apps/wait-for-container-app-activation.ts';
export { deployWithActivationCheck } from './deploy/azure/container-apps/deploy-with-activation-check.ts';
export type {
  DeployWithActivationCheckOptions,
  DeployWithActivationCheckResult,
} from './deploy/azure/container-apps/deploy-with-activation-check.ts';
// GCP Cloud Run
export { deployCloudRunService } from './deploy/gcp/cloud-run-services.ts';
export { waitForCloudRunService } from './deploy/gcp/wait-for-cloud-run-service.ts';
export type { WaitForCloudRunServiceOptions } from './deploy/gcp/wait-for-cloud-run-service.ts';
export type {
  CloudRunServiceOptions,
  CloudRunServiceResult,
} from './deploy/gcp/cloud-run-services.ts';
export { executeCloudRunJob } from './deploy/gcp/cloud-run-jobs.ts';
export { createOrUpdateCloudRunJob } from './deploy/gcp/create-or-update-cloud-run-job.ts';
export type { CloudRunJobDefinitionOptions } from './deploy/gcp/create-or-update-cloud-run-job.ts';
export { runCloudRunJobAndWait } from './deploy/gcp/run-cloud-run-job-and-wait.ts';
export type {
  RunCloudRunJobOptions,
  RunCloudRunJobResult,
} from './deploy/gcp/run-cloud-run-job-and-wait.ts';
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
// Name case utilities
export { toScreamingSnakeCase } from './utils/naming/to-screaming-snake-case.ts';
export { toSnakeCase } from './utils/naming/to-snake-case.ts';
export { toKebabCase } from './utils/naming/to-kebab-case.ts';
// Credential name utilities
export { toEnvVarPrefix } from './utils/credentials/to-env-var-prefix.ts';
export { toServiceEnvVarName } from './utils/credentials/to-service-env-var-name.ts';
export { fromServiceEnvVarName } from './utils/credentials/from-service-env-var-name.ts';

// Constants
export {
  MIME_TYPES,
  CLOUD_CAPACITY_ERROR_PATTERNS,
  AZURE_APP_SERVICE_AUTOSCALE,
  AZURE_APP_SERVICE_HEALTH_CHECK,
  AZURE_KONG_CLIENT_IP_SETTINGS,
  AZURE_NEXTJS_CLIENT_IP_SETTINGS,
  AZURE_KONG_PRIVATE_ENDPOINT,
  GCP_EDGE_CLIENT_IP_HEADER,
  GCP_KONG_CLIENT_IP_SETTINGS,
  GCP_NEXTJS_CLIENT_IP_SETTINGS,
  EDGE_CLIENT_IP_HEADER,
  AWS_KONG_CLIENT_IP_SETTINGS,
  AWS_NEXTJS_CLIENT_IP_SETTINGS,
  AWS_KONG_CLOUD_MAP_NAME,
  DEFAULT_SERVICE_LOG_LEVEL,
  DEFAULT_TRACE_SAMPLE_RATE,
  DEFAULT_SCHEDULED_JOB_METHOD,
  DEFAULT_SCHEDULED_JOB_TIMEZONE,
  SCHEDULED_JOB_HTTP_TIMEOUT,
  SCHEDULED_JOB_TYPES,
  CRON_JOB_TYPE,
  TRIGGER_JOB_TYPE,
  CRON_JOB_TIMEOUT,
  CRON_JOB_PLATFORM_TIMEOUT_MARGIN_SECONDS,
  CRON_JOB_NAME_PREFIX,
  CRON_JOB_COMMAND,
  CRON_JOB_NAME_ENV,
  CRON_JOB_TIMEOUT_ENV,
  CRON_FINISHED_MESSAGE,
  CRON_JOB_NAME_PATTERN,
  CRON_JOB_NAME_MAX_LENGTH,
  CRON_ENTRY_FILE,
  CRON_HANDLER_DIR,
  CRON_HANDLER_SUFFIX,
  APPS_DIR,
  AWS_CRON_JOB_SERVICE_TAG,
  AWS_CRON_JOB_NAME_TAG,
  AWS_PROJECT_TAG,
  AWS_CRON_JOB_LOG_STREAM_PREFIX,
  NAMING_SCHEMES,
  NAMING_SCHEME_OUTPUT,
  ACCOUNT_SUFFIX_LENGTH,
  GCP_CLOUD_RUN_NAME_MAX_LENGTH,
  GCP_RUN_APP_HOST_LABEL_MAX_LENGTH,
  GCS_BUCKET_NAME_MAX_LENGTH,
  GCP_PROJECT_LABEL,
  GCP_SCHEDULER_PROJECT_DESCRIPTION_PREFIX,
  AZURE_NAME_MAX_LENGTH,
  AZURE_NAME_HASH_LENGTH,
  DEPLOYED_AT_ENV_VAR,
  DB_EXPORT_RETENTION_DAYS,
  DB_EXPORT_JOB_TIMEOUT_SECONDS,
  DB_EXPORT_REASONS,
  DB_EXPORT_FILE_EXTENSION,
  DB_SERVER_POSTGRES_VERSION,
  DB_EXPORT_AZURE_CONTAINER,
  ECS_TASK_EXIT_CODE_GRACE_POLLS,
} from './constants/index.ts';
export {
  GCP_DATABASE_CONNECTION_LIMITS,
  DEFAULT_DATABASE_TIER,
  AWS_DATABASE_CONNECTION_LIMITS,
  DEFAULT_AWS_DATABASE_TIER,
  AZURE_DATABASE_CONNECTION_LIMITS,
  DEFAULT_AZURE_DATABASE_TIER,
} from './constants/index.ts';
