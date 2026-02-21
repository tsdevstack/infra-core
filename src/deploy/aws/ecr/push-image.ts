/**
 * Push a single Docker image
 *
 * Uses spawn for async execution suitable for parallel pushes.
 */

import { spawn } from 'node:child_process';

export interface PushImageResult {
  success: boolean;
  error?: string;
}

/**
 * Push a single Docker image using spawn (for parallel execution)
 */
export function pushImage(
  imageTag: string,
  cwd: string,
): Promise<PushImageResult> {
  return new Promise((resolve) => {
    const child = spawn('docker', ['push', imageTag], {
      cwd,
      stdio: 'pipe',
    });

    let stderr = '';
    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve({ success: true });
      } else {
        resolve({ success: false, error: stderr.slice(-500) });
      }
    });

    child.on('error', (err) => {
      resolve({ success: false, error: err.message });
    });
  });
}
