/**
 * Check if Terraform CLI is installed
 */

import { execSync } from 'child_process';
import type { InfraCoreRuntime } from '../types/runtime.ts';
import { InfraCoreError } from '../runtime/infra-core-error.ts';

export function checkTerraformInstalled(runtime: InfraCoreRuntime): boolean {
  void runtime; // runtime passed for consistency; error uses InfraCoreError directly

  try {
    execSync('terraform version', { stdio: 'pipe' });
    return true;
  } catch {
    throw new InfraCoreError(
      'Terraform CLI not found',
      'infra',
      'Install Terraform: https://developer.hashicorp.com/terraform/install',
    );
  }
}
