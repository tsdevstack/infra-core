import { generateIamRolesTf } from './generate-iam-roles-tf.ts';
import { generateSecretScopeExclusionsTf } from './generate-secret-scope-exclusions-tf.ts';

/**
 * Generate iam.tf with IAM roles and policies for ECS
 *
 * Roles created:
 * - ECS Task Execution Role (shared): Pull images, fetch secrets at startup
 * - ECS Task Roles (per service): Runtime permissions for running containers
 * - Next.js Task Roles (per Next.js service): Runtime permissions for Next.js containers
 *
 * Note: Lambda roles are defined in their respective terraform files
 * (eventbridge.tf for the job invoker) to keep them colocated with their functions.
 *
 * A role allowed `{project}-{name}-*` also matches the secrets of a service
 * whose name starts with `{name}-` (`auth` next to `auth-service`). Only
 * then, a separate inline policy denies those; the allow policies stay as
 * they are for every project.
 *
 * @param secretScopes - Every secret scope: the service names
 */
export function generateIamTf(secretScopes: string[] = []): string {
  return `${generateIamRolesTf()}${generateSecretScopeExclusionsTf(secretScopes)}`;
}
