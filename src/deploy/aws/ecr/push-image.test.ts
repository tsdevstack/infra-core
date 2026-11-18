import { describe, it, expect, rs, beforeEach } from '@rstest/core';
import { EventEmitter } from 'node:events';

interface FakeChild extends EventEmitter {
  stderr: EventEmitter;
}

let child: FakeChild;
const mockSpawn = rs.fn(() => child);

rs.mock('node:child_process', () => ({
  spawn: (...args: unknown[]) => mockSpawn(...(args as [])),
}));

import { pushImage } from './push-image.ts';

function newChild(): FakeChild {
  const emitter = new EventEmitter() as FakeChild;
  emitter.stderr = new EventEmitter();
  return emitter;
}

describe('pushImage', () => {
  beforeEach(() => {
    rs.clearAllMocks();
    child = newChild();
  });

  describe('Standard use cases', () => {
    it('should run docker push for the tag in the given folder', async () => {
      const result = pushImage('repo/app:abc', '/project');
      child.emit('close', 0);

      expect(await result).toEqual({ success: true });
      expect(mockSpawn).toHaveBeenCalledWith(
        'docker',
        ['push', 'repo/app:abc'],
        { cwd: '/project', stdio: 'pipe' },
      );
    });

    it("should report a failed push with Docker's error output", async () => {
      const result = pushImage('repo/app:abc', '/project');
      child.stderr.emit('data', Buffer.from('denied: requested access'));
      child.emit('close', 1);

      expect(await result).toEqual({
        success: false,
        error: 'denied: requested access',
      });
    });
  });

  describe('Edge cases', () => {
    it('should keep only the last 500 characters of a long error', async () => {
      const result = pushImage('repo/app:abc', '/project');
      child.stderr.emit('data', Buffer.from('x'.repeat(600) + 'END'));
      child.emit('close', 1);

      const { error } = await result;
      expect(error).toHaveLength(500);
      expect(error?.endsWith('END')).toBe(true);
    });

    it('should report a Docker that cannot start', async () => {
      const result = pushImage('repo/app:abc', '/project');
      child.emit('error', new Error('spawn docker ENOENT'));

      expect(await result).toEqual({
        success: false,
        error: 'spawn docker ENOENT',
      });
    });
  });
});
