/**
 * AWS deployment utilities
 */

export { configureEcrAuth } from './ecr/configure-ecr-auth.ts';
export { pushImage } from './ecr/push-image.ts';
export type { PushImageResult } from './ecr/push-image.ts';
export { uploadSpaToS3 } from './upload-spa-to-s3.ts';
export type {
  UploadSpaToS3Options,
  UploadSpaToS3Result,
} from './upload-spa-to-s3.ts';
export { invalidateCloudfront } from './invalidate-cloudfront.ts';
export type {
  InvalidateCloudfrontOptions,
  InvalidateCloudfrontResult,
} from './invalidate-cloudfront.ts';

// ECS (Session 3)
export { deployEcsServiceWithSecrets } from './ecs/deploy-ecs-service-with-secrets.ts';
export type {
  DeployEcsServiceWithSecretsOptions,
  DeployEcsServiceWithSecretsResult,
} from './ecs/deploy-ecs-service-with-secrets.ts';
export { updateEcsService } from './ecs/update-ecs-service.ts';
export type {
  UpdateEcsServiceOptions,
  UpdateEcsServiceResult,
} from './ecs/update-ecs-service.ts';
export { executeEcsTask } from './ecs/execute-ecs-task.ts';
export type { EcsTaskOptions, EcsTaskResult } from './ecs/execute-ecs-task.ts';
export { waitForEcsStable } from './ecs/wait-for-ecs-stable.ts';
export type {
  WaitForEcsStableOptions,
  WaitForEcsStableResult,
} from './ecs/wait-for-ecs-stable.ts';
export { deleteEcsService } from './ecs/delete-ecs-service.ts';
export type {
  DeleteEcsServiceOptions,
  DeleteEcsServiceResult,
} from './ecs/delete-ecs-service.ts';
