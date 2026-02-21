/**
 * Types for Terraform CLI execution
 */

export type TerraformCommand =
  | 'init'
  | 'plan'
  | 'apply'
  | 'destroy'
  | 'output'
  | 'force-unlock'
  | 'import';

export interface TerraformExecuteOptions {
  /** Directory containing .tf files */
  workDir: string;
  /** Auto-approve changes (skip confirmation) */
  autoApprove?: boolean;
  /** Additional environment variables */
  env?: Record<string, string>;
  /** Target specific resource (for targeted apply) */
  target?: string;
  /** Target multiple resources (for targeted apply with multiple -target flags) */
  targets?: string[];
  /** Path to .tfvars file */
  varFile?: string;
  /** Reconfigure backend (for init command) */
  reconfigure?: boolean;
  /** Lock ID for force-unlock command */
  lockId?: string;
  /** Resource address for import command (e.g., "azurerm_cdn_frontdoor_custom_domain.app") */
  importAddress?: string;
  /** Resource ID for import command (e.g., Azure resource ID) */
  importId?: string;
  /** Limit concurrent operations (terraform -parallelism=N) */
  parallelism?: number;
}

export interface TerraformResult {
  success: boolean;
  output: string;
  error?: string;
}
