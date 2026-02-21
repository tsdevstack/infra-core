/**
 * Get all files recursively from a directory
 *
 * Returns relative paths from the base directory.
 */

import fs from 'node:fs';
import path from 'node:path';

/**
 * Get all files recursively from a directory
 *
 * @param dir - Directory to scan
 * @param baseDir - Base directory for relative paths (defaults to dir)
 * @returns Array of relative file paths
 */
export function getAllFiles(dir: string, baseDir: string = dir): string[] {
  const files: string[] = [];

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getAllFiles(fullPath, baseDir));
    } else {
      // Return relative path from base directory
      files.push(path.relative(baseDir, fullPath));
    }
  }

  return files;
}
