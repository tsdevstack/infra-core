import { describe, it, expect, beforeEach, afterEach } from '@rstest/core';
import { getAllFiles } from './get-all-files.ts';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

describe('getAllFiles', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'get-all-files-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('should return empty array for empty directory', () => {
    const result = getAllFiles(tempDir);
    expect(result).toEqual([]);
  });

  it('should return files in root directory', () => {
    fs.writeFileSync(path.join(tempDir, 'file1.txt'), 'content');
    fs.writeFileSync(path.join(tempDir, 'file2.txt'), 'content');

    const result = getAllFiles(tempDir);

    expect(result.sort()).toEqual(['file1.txt', 'file2.txt'].sort());
  });

  it('should return files from nested directories', () => {
    fs.mkdirSync(path.join(tempDir, 'subdir'));
    fs.writeFileSync(path.join(tempDir, 'root.txt'), 'content');
    fs.writeFileSync(path.join(tempDir, 'subdir', 'nested.txt'), 'content');

    const result = getAllFiles(tempDir);

    expect(result.sort()).toEqual(
      ['root.txt', path.join('subdir', 'nested.txt')].sort(),
    );
  });

  it('should handle deeply nested directories', () => {
    fs.mkdirSync(path.join(tempDir, 'a', 'b', 'c'), { recursive: true });
    fs.writeFileSync(path.join(tempDir, 'a', 'b', 'c', 'deep.txt'), 'content');

    const result = getAllFiles(tempDir);

    expect(result).toEqual([path.join('a', 'b', 'c', 'deep.txt')]);
  });

  it('should return relative paths from base directory', () => {
    fs.mkdirSync(path.join(tempDir, 'subdir'));
    fs.writeFileSync(path.join(tempDir, 'subdir', 'file.txt'), 'content');

    const result = getAllFiles(tempDir);

    // Should be relative, not absolute
    expect(result[0]).not.toContain(tempDir);
    expect(result).toEqual([path.join('subdir', 'file.txt')]);
  });

  it('should work with custom base directory', () => {
    fs.mkdirSync(path.join(tempDir, 'subdir'));
    fs.writeFileSync(path.join(tempDir, 'subdir', 'file.txt'), 'content');

    const result = getAllFiles(path.join(tempDir, 'subdir'), tempDir);

    expect(result).toEqual([path.join('subdir', 'file.txt')]);
  });
});
