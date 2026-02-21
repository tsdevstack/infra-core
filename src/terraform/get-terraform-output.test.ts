import { describe, it, expect, rs, beforeEach } from '@rstest/core';
import { execSync } from 'node:child_process';

rs.mock('node:child_process', () => ({
  execSync: rs.fn(),
}));

import { getTerraformOutput } from './get-terraform-output';

describe('getTerraformOutput', () => {
  beforeEach(() => {
    rs.clearAllMocks();
  });

  it('should call execSync with terraform output command', () => {
    rs.mocked(execSync).mockReturnValue('output-value\n');

    getTerraformOutput('/path/to/terraform', 'my_output', {});

    expect(execSync).toHaveBeenCalledWith(
      'terraform output -raw my_output',
      expect.objectContaining({
        cwd: '/path/to/terraform',
        encoding: 'utf-8',
      }),
    );
  });

  it('should trim the output', () => {
    rs.mocked(execSync).mockReturnValue('  output-value  \n');

    const result = getTerraformOutput('/path', 'output', {});

    expect(result).toBe('output-value');
  });

  it('should merge provided env with process.env', () => {
    rs.mocked(execSync).mockReturnValue('value');

    getTerraformOutput('/path', 'output', { TF_VAR_test: 'test-value' });

    expect(execSync).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        env: expect.objectContaining({
          TF_VAR_test: 'test-value',
        }),
      }),
    );
  });

  it('should use stdio pipe for all streams', () => {
    rs.mocked(execSync).mockReturnValue('value');

    getTerraformOutput('/path', 'output', {});

    expect(execSync).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        stdio: ['pipe', 'pipe', 'pipe'],
      }),
    );
  });

  it('should handle different output names', () => {
    rs.mocked(execSync).mockReturnValue('value');

    getTerraformOutput('/path', 'database_instance_name', {});

    expect(execSync).toHaveBeenCalledWith(
      'terraform output -raw database_instance_name',
      expect.any(Object),
    );
  });

  it('should propagate errors from execSync', () => {
    rs.mocked(execSync).mockImplementation(() => {
      throw new Error('Output not found');
    });

    expect(() => getTerraformOutput('/path', 'missing_output', {})).toThrow(
      'Output not found',
    );
  });
});
