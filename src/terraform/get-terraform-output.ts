/**
 * Get Terraform output value
 */

import { execSync } from 'node:child_process';

/**
 * Get Terraform output value
 */
export function getTerraformOutput(
  outputDir: string,
  name: string,
  env: Record<string, string>,
): string {
  const result = execSync(`terraform output -raw ${name}`, {
    cwd: outputDir,
    encoding: 'utf-8',
    env: { ...process.env, ...env },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  return result.trim();
}
