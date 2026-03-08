import { describe, it, expect, rs, beforeEach } from '@rstest/core';

const mockSpawnSync = rs.fn();

rs.mock('node:child_process', () => ({
  spawnSync: (...args: unknown[]) => mockSpawnSync(...args),
}));

import { dockerLoginViaStdin } from './docker-login-via-stdin.ts';

describe('dockerLoginViaStdin', () => {
  beforeEach(() => {
    rs.clearAllMocks();
  });

  it('should call docker login with --password-stdin', () => {
    mockSpawnSync.mockReturnValue({
      status: 0,
      stderr: '',
      stdout: 'Login Succeeded',
    });

    dockerLoginViaStdin('registry.example.com', 'myuser', 'mypass');

    expect(mockSpawnSync).toHaveBeenCalledWith(
      'docker',
      [
        'login',
        '--username',
        'myuser',
        '--password-stdin',
        'registry.example.com',
      ],
      {
        input: 'mypass',
        encoding: 'utf-8',
      },
    );
  });

  it('should not throw when docker login succeeds', () => {
    mockSpawnSync.mockReturnValue({
      status: 0,
      stderr: '',
      stdout: 'Login Succeeded',
    });

    expect(() =>
      dockerLoginViaStdin('registry.example.com', 'user', 'pass'),
    ).not.toThrow();
  });

  it('should throw with stderr message when docker login fails', () => {
    mockSpawnSync.mockReturnValue({
      status: 1,
      stderr: 'unauthorized: authentication required',
      stdout: '',
    });

    expect(() =>
      dockerLoginViaStdin('registry.example.com', 'user', 'pass'),
    ).toThrow('Docker login failed: unauthorized: authentication required');
  });

  it('should fall back to stdout when stderr is empty', () => {
    mockSpawnSync.mockReturnValue({
      status: 1,
      stderr: '',
      stdout: 'some stdout error',
    });

    expect(() =>
      dockerLoginViaStdin('registry.example.com', 'user', 'pass'),
    ).toThrow('Docker login failed: some stdout error');
  });

  it('should use "Unknown error" when both stderr and stdout are empty', () => {
    mockSpawnSync.mockReturnValue({
      status: 1,
      stderr: '',
      stdout: '',
    });

    expect(() =>
      dockerLoginViaStdin('registry.example.com', 'user', 'pass'),
    ).toThrow('Docker login failed: Unknown error');
  });
});
