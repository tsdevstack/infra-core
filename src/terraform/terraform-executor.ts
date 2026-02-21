/**
 * Execute Terraform CLI commands
 */

import { spawn } from 'child_process';
import type {
  TerraformCommand,
  TerraformExecuteOptions,
  TerraformResult,
} from './types.ts';

/**
 * Execute a terraform command and stream output to console
 */
export async function executeTerraform(
  command: TerraformCommand,
  options: TerraformExecuteOptions,
): Promise<TerraformResult> {
  const {
    workDir,
    autoApprove,
    env,
    target,
    varFile,
    reconfigure,
    lockId,
    importAddress,
    importId,
  } = options;

  const args: string[] = [command];

  // Handle import command
  if (command === 'import') {
    if (!importAddress || !importId) {
      return {
        success: false,
        output: '',
        error: 'importAddress and importId are required for import command',
      };
    }
    args.push(importAddress);
    args.push(importId);
  }

  // Handle force-unlock command
  if (command === 'force-unlock') {
    if (!lockId) {
      return {
        success: false,
        output: '',
        error: 'lockId is required for force-unlock command',
      };
    }
    // -force skips the confirmation prompt
    args.push('-force');
    args.push(lockId);
  }

  // Add auto-approve flag for apply and destroy
  if (autoApprove && (command === 'apply' || command === 'destroy')) {
    args.push('-auto-approve');
  }

  // Add -reconfigure flag for init (handles backend changes)
  if (reconfigure && command === 'init') {
    args.push('-reconfigure');
  }

  // Add -input=false for non-interactive mode
  if (
    command === 'init' ||
    command === 'apply' ||
    command === 'plan' ||
    command === 'destroy'
  ) {
    args.push('-input=false');
  }

  // Add -target for targeted operations (single target)
  if (
    target &&
    (command === 'apply' || command === 'destroy' || command === 'plan')
  ) {
    args.push(`-target=${target}`);
  }

  // Add -target for multiple targeted operations
  if (
    options.targets?.length &&
    (command === 'apply' || command === 'destroy' || command === 'plan')
  ) {
    for (const t of options.targets) {
      args.push(`-target=${t}`);
    }
  }

  // Add -var-file for variable files
  if (
    varFile &&
    (command === 'apply' || command === 'destroy' || command === 'plan')
  ) {
    args.push(`-var-file=${varFile}`);
  }

  // Add -parallelism for limiting concurrent operations
  if (
    options.parallelism !== undefined &&
    (command === 'apply' || command === 'destroy' || command === 'plan')
  ) {
    args.push(`-parallelism=${options.parallelism}`);
  }

  return new Promise((resolve) => {
    const child = spawn('terraform', args, {
      cwd: workDir,
      env: {
        ...process.env,
        ...env,
      },
      stdio: ['inherit', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data: Buffer) => {
      const text = data.toString();
      stdout += text;
      process.stdout.write(text);
    });

    child.stderr?.on('data', (data: Buffer) => {
      const text = data.toString();
      stderr += text;
      process.stderr.write(text);
    });

    child.on('close', (code) => {
      // Combine stdout and stderr for output (needed for lock ID extraction)
      const combinedOutput = stdout + stderr;

      if (code === 0) {
        resolve({
          success: true,
          output: combinedOutput,
        });
      } else {
        resolve({
          success: false,
          output: combinedOutput,
          error: undefined,
        });
      }
    });

    child.on('error', (err) => {
      resolve({
        success: false,
        output: stdout,
        error: err.message,
      });
    });
  });
}
