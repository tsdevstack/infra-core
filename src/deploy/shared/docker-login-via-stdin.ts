/**
 * Login to Docker registry using stdin for password
 *
 * Uses --password-stdin to avoid leaking credentials to process listings.
 */

import { spawnSync } from 'node:child_process';

export function dockerLoginViaStdin(
  registryHost: string,
  username: string,
  password: string,
): void {
  const result = spawnSync(
    'docker',
    ['login', '--username', username, '--password-stdin', registryHost],
    {
      input: password,
      encoding: 'utf-8',
    },
  );

  if (result.status !== 0) {
    const errorMsg = result.stderr || result.stdout || 'Unknown error';
    throw new Error(`Docker login failed: ${errorMsg}`);
  }
}
