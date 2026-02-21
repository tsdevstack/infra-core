import { describe, it, expect, rs, beforeEach } from '@rstest/core';
import { EventEmitter } from 'events';

// Create mock child process
class MockChildProcess extends EventEmitter {
  stdout = new EventEmitter();
  stderr = new EventEmitter();
}

const mockSpawn = rs.fn();
rs.mock('child_process', () => ({
  spawn: (...args: unknown[]) => mockSpawn(...args),
}));

import { executeTerraform } from './terraform-executor';

describe('executeTerraform', () => {
  let mockChild: MockChildProcess;

  beforeEach(() => {
    rs.clearAllMocks();
    mockChild = new MockChildProcess();
    mockSpawn.mockReturnValue(mockChild);
  });

  describe('command execution', () => {
    it('should spawn terraform with correct command', async () => {
      const promise = executeTerraform('init', { workDir: '/test/dir' });
      mockChild.emit('close', 0);
      await promise;

      expect(mockSpawn).toHaveBeenCalledWith(
        'terraform',
        expect.arrayContaining(['init']),
        expect.any(Object),
      );
    });

    it('should use specified working directory', async () => {
      const promise = executeTerraform('plan', { workDir: '/my/project' });
      mockChild.emit('close', 0);
      await promise;

      expect(mockSpawn).toHaveBeenCalledWith(
        'terraform',
        expect.any(Array),
        expect.objectContaining({ cwd: '/my/project' }),
      );
    });

    it('should pass environment variables', async () => {
      const env = { GOOGLE_PROJECT: 'my-project' };
      const promise = executeTerraform('apply', { workDir: '/test', env });
      mockChild.emit('close', 0);
      await promise;

      expect(mockSpawn).toHaveBeenCalledWith(
        'terraform',
        expect.any(Array),
        expect.objectContaining({
          env: expect.objectContaining({ GOOGLE_PROJECT: 'my-project' }),
        }),
      );
    });
  });

  describe('auto-approve flag', () => {
    it('should add -auto-approve for apply when enabled', async () => {
      const promise = executeTerraform('apply', {
        workDir: '/test',
        autoApprove: true,
      });
      mockChild.emit('close', 0);
      await promise;

      expect(mockSpawn).toHaveBeenCalledWith(
        'terraform',
        expect.arrayContaining(['-auto-approve']),
        expect.any(Object),
      );
    });

    it('should add -auto-approve for destroy when enabled', async () => {
      const promise = executeTerraform('destroy', {
        workDir: '/test',
        autoApprove: true,
      });
      mockChild.emit('close', 0);
      await promise;

      expect(mockSpawn).toHaveBeenCalledWith(
        'terraform',
        expect.arrayContaining(['-auto-approve']),
        expect.any(Object),
      );
    });

    it('should not add -auto-approve for init', async () => {
      const promise = executeTerraform('init', {
        workDir: '/test',
        autoApprove: true,
      });
      mockChild.emit('close', 0);
      await promise;

      expect(mockSpawn).toHaveBeenCalledWith(
        'terraform',
        expect.not.arrayContaining(['-auto-approve']),
        expect.any(Object),
      );
    });

    it('should not add -auto-approve for plan', async () => {
      const promise = executeTerraform('plan', {
        workDir: '/test',
        autoApprove: true,
      });
      mockChild.emit('close', 0);
      await promise;

      expect(mockSpawn).toHaveBeenCalledWith(
        'terraform',
        expect.not.arrayContaining(['-auto-approve']),
        expect.any(Object),
      );
    });
  });

  describe('input flag', () => {
    it('should add -input=false for init', async () => {
      const promise = executeTerraform('init', { workDir: '/test' });
      mockChild.emit('close', 0);
      await promise;

      expect(mockSpawn).toHaveBeenCalledWith(
        'terraform',
        expect.arrayContaining(['-input=false']),
        expect.any(Object),
      );
    });

    it('should add -input=false for plan', async () => {
      const promise = executeTerraform('plan', { workDir: '/test' });
      mockChild.emit('close', 0);
      await promise;

      expect(mockSpawn).toHaveBeenCalledWith(
        'terraform',
        expect.arrayContaining(['-input=false']),
        expect.any(Object),
      );
    });

    it('should add -input=false for apply', async () => {
      const promise = executeTerraform('apply', { workDir: '/test' });
      mockChild.emit('close', 0);
      await promise;

      expect(mockSpawn).toHaveBeenCalledWith(
        'terraform',
        expect.arrayContaining(['-input=false']),
        expect.any(Object),
      );
    });

    it('should add -input=false for destroy', async () => {
      const promise = executeTerraform('destroy', { workDir: '/test' });
      mockChild.emit('close', 0);
      await promise;

      expect(mockSpawn).toHaveBeenCalledWith(
        'terraform',
        expect.arrayContaining(['-input=false']),
        expect.any(Object),
      );
    });
  });

  describe('import command', () => {
    it('should spawn terraform import with address and id', async () => {
      const promise = executeTerraform('import', {
        workDir: '/test',
        importAddress: 'azurerm_cdn_frontdoor_custom_domain.app',
        importId:
          '/subscriptions/xxx/resourceGroups/rg/providers/Microsoft.Cdn/profiles/fd/customDomains/app',
      });
      mockChild.emit('close', 0);
      await promise;

      expect(mockSpawn).toHaveBeenCalledWith(
        'terraform',
        [
          'import',
          'azurerm_cdn_frontdoor_custom_domain.app',
          '/subscriptions/xxx/resourceGroups/rg/providers/Microsoft.Cdn/profiles/fd/customDomains/app',
        ],
        expect.any(Object),
      );
    });

    it('should return error when importAddress is missing', async () => {
      const result = await executeTerraform('import', {
        workDir: '/test',
        importId: '/subscriptions/xxx/...',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('importAddress and importId are required');
      expect(mockSpawn).not.toHaveBeenCalled();
    });

    it('should return error when importId is missing', async () => {
      const result = await executeTerraform('import', {
        workDir: '/test',
        importAddress: 'azurerm_cdn_frontdoor_custom_domain.app',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('importAddress and importId are required');
      expect(mockSpawn).not.toHaveBeenCalled();
    });
  });

  describe('targets flag', () => {
    it('should add multiple -target flags for apply', async () => {
      const promise = executeTerraform('apply', {
        workDir: '/test',
        targets: [
          'azurerm_cdn_frontdoor_route.api',
          'azurerm_cdn_frontdoor_route.app',
          'azurerm_cdn_frontdoor_security_policy.main',
        ],
      });
      mockChild.emit('close', 0);
      await promise;

      const args = mockSpawn.mock.calls[0][1] as string[];
      expect(args).toContain('-target=azurerm_cdn_frontdoor_route.api');
      expect(args).toContain('-target=azurerm_cdn_frontdoor_route.app');
      expect(args).toContain(
        '-target=azurerm_cdn_frontdoor_security_policy.main',
      );
    });

    it('should add -target flags for plan', async () => {
      const promise = executeTerraform('plan', {
        workDir: '/test',
        targets: ['azurerm_cdn_frontdoor_route.api'],
      });
      mockChild.emit('close', 0);
      await promise;

      const args = mockSpawn.mock.calls[0][1] as string[];
      expect(args).toContain('-target=azurerm_cdn_frontdoor_route.api');
    });

    it('should not add -target flags for init', async () => {
      const promise = executeTerraform('init', {
        workDir: '/test',
        targets: ['azurerm_cdn_frontdoor_route.api'],
      });
      mockChild.emit('close', 0);
      await promise;

      const args = mockSpawn.mock.calls[0][1] as string[];
      expect(args).not.toContain('-target=azurerm_cdn_frontdoor_route.api');
    });
  });

  describe('parallelism flag', () => {
    it('should add -parallelism for apply', async () => {
      const promise = executeTerraform('apply', {
        workDir: '/test',
        parallelism: 1,
      });
      mockChild.emit('close', 0);
      await promise;

      expect(mockSpawn).toHaveBeenCalledWith(
        'terraform',
        expect.arrayContaining(['-parallelism=1']),
        expect.any(Object),
      );
    });

    it('should add -parallelism for plan', async () => {
      const promise = executeTerraform('plan', {
        workDir: '/test',
        parallelism: 5,
      });
      mockChild.emit('close', 0);
      await promise;

      expect(mockSpawn).toHaveBeenCalledWith(
        'terraform',
        expect.arrayContaining(['-parallelism=5']),
        expect.any(Object),
      );
    });

    it('should not add -parallelism for init', async () => {
      const promise = executeTerraform('init', {
        workDir: '/test',
        parallelism: 1,
      });
      mockChild.emit('close', 0);
      await promise;

      expect(mockSpawn).toHaveBeenCalledWith(
        'terraform',
        expect.not.arrayContaining(['-parallelism=1']),
        expect.any(Object),
      );
    });
  });

  describe('result handling', () => {
    it('should return success when exit code is 0', async () => {
      const promise = executeTerraform('init', { workDir: '/test' });
      mockChild.emit('close', 0);
      const result = await promise;

      expect(result.success).toBe(true);
    });

    it('should return failure when exit code is non-zero', async () => {
      const promise = executeTerraform('apply', { workDir: '/test' });
      mockChild.emit('close', 1);
      const result = await promise;

      expect(result.success).toBe(false);
    });

    it('should capture stdout in output', async () => {
      const promise = executeTerraform('plan', { workDir: '/test' });
      mockChild.stdout.emit('data', Buffer.from('Plan output'));
      mockChild.emit('close', 0);
      const result = await promise;

      expect(result.output).toContain('Plan output');
    });

    it('should return error on spawn error', async () => {
      const promise = executeTerraform('init', { workDir: '/test' });
      mockChild.emit('error', new Error('Spawn failed'));
      const result = await promise;

      expect(result.success).toBe(false);
      expect(result.error).toBe('Spawn failed');
    });
  });
});
