import { describe, it, expect, rs, beforeEach } from '@rstest/core';
import type { InfraCoreRuntime } from '../types/runtime';
import { InfraCoreError } from '../runtime/infra-core-error';

const mockExecSync = rs.fn();
rs.mock('child_process', () => ({
  execSync: (...args: unknown[]) => mockExecSync(...args),
}));

import { checkTerraformInstalled } from './check-terraform-installed';

const mockRuntime = {} as InfraCoreRuntime;

describe('checkTerraformInstalled', () => {
  beforeEach(() => {
    rs.clearAllMocks();
  });

  describe('when terraform is installed', () => {
    it('should return true', () => {
      mockExecSync.mockReturnValue('Terraform v1.5.0');

      const result = checkTerraformInstalled(mockRuntime);

      expect(result).toBe(true);
    });

    it('should check terraform version command', () => {
      mockExecSync.mockReturnValue('Terraform v1.5.0');

      checkTerraformInstalled(mockRuntime);

      expect(mockExecSync).toHaveBeenCalledWith('terraform version', {
        stdio: 'pipe',
      });
    });
  });

  describe('when terraform is not installed', () => {
    it('should throw InfraCoreError', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('command not found');
      });

      expect(() => checkTerraformInstalled(mockRuntime)).toThrow(
        InfraCoreError,
      );
    });

    it('should include helpful message in error', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('command not found');
      });

      try {
        checkTerraformInstalled(mockRuntime);
        expect.fail('Should have thrown');
      } catch (error) {
        expect((error as Error).message).toContain('Terraform CLI not found');
      }
    });
  });
});
