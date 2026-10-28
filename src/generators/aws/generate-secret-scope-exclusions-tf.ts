import { findSecretScopeOverlaps } from '../../utils/secrets/find-secret-scope-overlaps.ts';

/**
 * Explicit Deny for the secrets a role's name prefix also covers. Empty when
 * no names overlap. Deny always wins over the role's Allow.
 *
 * @param secretScopes - Every secret scope: the service names
 */
export function generateSecretScopeExclusionsTf(
  secretScopes: string[],
): string {
  const overlaps = Object.entries(findSecretScopeOverlaps(secretScopes));
  if (overlaps.length === 0) {
    return '';
  }

  const exclusions = overlaps
    .map(
      ([scope, covered]) =>
        `    "${scope}" = [${covered.map((c) => `"${c}"`).join(', ')}]`,
    )
    .join('\n');

  return `
# =============================================================================
# Secret Scope Exclusions
# A role allowed {project}-{name}-* also matches the secrets of a service
# whose name starts with "{name}-" (a service "auth" next to "auth-service").
# This Deny keeps them out; Deny always wins over the Allow above.
# =============================================================================

locals {
  secret_scope_exclusions = tomap({
${exclusions}
  })
}

resource "aws_iam_role_policy" "task_secrets_exclusions" {
  for_each = { for name, excluded in local.secret_scope_exclusions : name => excluded if contains(keys(var.services), name) }

  name = "secrets-exclusions"
  role = aws_iam_role.task[each.key].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Deny"
      Action   = ["secretsmanager:GetSecretValue"]
      Resource = [for other in each.value : "arn:aws:secretsmanager:\${var.aws_region}:\${var.aws_account_id}:secret:\${var.project_name}-\${other}-*"]
    }]
  })
}

resource "aws_iam_role_policy" "nextjs_task_secrets_exclusions" {
  for_each = { for name, excluded in local.secret_scope_exclusions : name => excluded if contains(keys(var.nextjs_services), name) }

  name = "secrets-exclusions"
  role = aws_iam_role.nextjs_task[each.key].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Deny"
      Action   = ["secretsmanager:GetSecretValue"]
      Resource = [for other in each.value : "arn:aws:secretsmanager:\${var.aws_region}:\${var.aws_account_id}:secret:\${var.project_name}-\${other}-*"]
    }]
  })
}
`;
}
