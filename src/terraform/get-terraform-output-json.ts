/**
 * Get terraform output as parsed JSON (for complex types like maps/objects)
 */

import { execSync } from 'node:child_process';

export function getTerraformOutputJson<T>(
  outputDir: string,
  name: string,
  env: Record<string, string>,
): T {
  const result = execSync(`terraform output -json ${name}`, {
    cwd: outputDir,
    encoding: 'utf-8',
    env: { ...process.env, ...env },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  return JSON.parse(result.trim()) as T;
}
