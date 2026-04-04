/**
 * Terraform execution utilities
 */

export { executeTerraform } from './terraform-executor.ts';
export { checkTerraformInstalled } from './check-terraform-installed.ts';
export { getTerraformOutput } from './get-terraform-output.ts';
export { getTerraformOutputJson } from './get-terraform-output-json.ts';
export { extractLockId } from './extract-lock-id.ts';
export { extractImportTargets } from './extract-import-targets.ts';
export type { ImportTarget } from './extract-import-targets.ts';
export { detectRouteAssociationError } from './detect-route-association-error.ts';
export { extractCnameConflicts } from './aws/extract-cname-conflicts.ts';
export type { CnameConflictTarget } from './aws/extract-cname-conflicts.ts';
export type {
  TerraformCommand,
  TerraformExecuteOptions,
  TerraformResult,
} from './types.ts';
