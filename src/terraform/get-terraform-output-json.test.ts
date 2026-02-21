import { describe, it, expect, rs, beforeEach, afterEach } from '@rstest/core';
import { getTerraformOutputJson } from './get-terraform-output-json';
import { execSync } from 'node:child_process';

rs.mock('node:child_process', () => ({
  execSync: rs.fn(),
}));

describe('getTerraformOutputJson', () => {
  const mockExecSync = rs.mocked(execSync);

  beforeEach(() => {
    rs.clearAllMocks();
  });

  afterEach(() => {
    rs.restoreAllMocks();
  });

  it('should execute terraform output with -json flag', () => {
    mockExecSync.mockReturnValue('{"key": "value"}');

    getTerraformOutputJson('/path/to/tf', 'my_output', { FOO: 'bar' });

    expect(mockExecSync).toHaveBeenCalledWith(
      'terraform output -json my_output',
      expect.objectContaining({
        cwd: '/path/to/tf',
      }),
    );
  });

  it('should pass environment variables', () => {
    mockExecSync.mockReturnValue('{}');

    getTerraformOutputJson('/path', 'out', { CUSTOM_VAR: 'test' });

    expect(mockExecSync).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        env: expect.objectContaining({ CUSTOM_VAR: 'test' }),
      }),
    );
  });

  it('should parse JSON object output', () => {
    mockExecSync.mockReturnValue(
      '{"auth-service": "sa1@gcp.com", "bff-service": "sa2@gcp.com"}',
    );

    const result = getTerraformOutputJson<Record<string, string>>(
      '/path',
      'service_accounts',
      {},
    );

    expect(result).toEqual({
      'auth-service': 'sa1@gcp.com',
      'bff-service': 'sa2@gcp.com',
    });
  });

  it('should parse JSON array output', () => {
    mockExecSync.mockReturnValue('["item1", "item2", "item3"]');

    const result = getTerraformOutputJson<string[]>('/path', 'items', {});

    expect(result).toEqual(['item1', 'item2', 'item3']);
  });

  it('should handle nested JSON', () => {
    mockExecSync.mockReturnValue('{"level1": {"level2": {"value": 123}}}');

    const result = getTerraformOutputJson<{
      level1: { level2: { value: number } };
    }>('/path', 'nested', {});

    expect(result.level1.level2.value).toBe(123);
  });

  it('should trim whitespace from output', () => {
    mockExecSync.mockReturnValue('  {"key": "value"}  \n');

    const result = getTerraformOutputJson<{ key: string }>('/path', 'out', {});

    expect(result).toEqual({ key: 'value' });
  });
});
