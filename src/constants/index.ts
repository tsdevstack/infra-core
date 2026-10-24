/**
 * Constants barrel export
 */

export { MIME_TYPES } from './mime-types.ts';

export { CLOUD_CAPACITY_ERROR_PATTERNS } from './cloud-capacity-errors.ts';

export {
  AZURE_APP_SERVICE_AUTOSCALE,
  AZURE_APP_SERVICE_HEALTH_CHECK,
  AZURE_KONG_CLIENT_IP_SETTINGS,
  AZURE_NEXTJS_CLIENT_IP_SETTINGS,
  AZURE_KONG_PRIVATE_ENDPOINT,
} from './azure-app-service.ts';

export {
  GCP_DATABASE_CONNECTION_LIMITS,
  DEFAULT_DATABASE_TIER,
} from './gcp-database-tiers.ts';

export {
  GCP_EDGE_CLIENT_IP_HEADER,
  GCP_KONG_CLIENT_IP_SETTINGS,
  GCP_NEXTJS_CLIENT_IP_SETTINGS,
} from './gcp-client-ip.ts';

export { EDGE_CLIENT_IP_HEADER } from './edge-client-ip.ts';

export {
  AWS_KONG_CLIENT_IP_SETTINGS,
  AWS_NEXTJS_CLIENT_IP_SETTINGS,
  AWS_KONG_CLOUD_MAP_NAME,
} from './aws-client-ip.ts';

export {
  AWS_DATABASE_CONNECTION_LIMITS,
  DEFAULT_AWS_DATABASE_TIER,
} from './aws-database-tiers.ts';

export {
  AZURE_DATABASE_CONNECTION_LIMITS,
  DEFAULT_AZURE_DATABASE_TIER,
} from './azure-database-tiers.ts';

export {
  ECS_MIGRATION_CONTAINER_NAME,
  ECS_TASK_EXIT_CODE_GRACE_POLLS,
} from './aws-ecs-task.ts';
