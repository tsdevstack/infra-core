import { describe, it, expect } from '@rstest/core';
import { defaultLogger, InfraCoreError } from '../src/index';
import type {
  InfraConfig,
  AzureInfraConfig,
  AWSInfraConfig,
  GCPInfraConfig,
  InfraCoreLogger,
} from '../src/index';

describe('defaultLogger', () => {
  it('should have all required methods', () => {
    const methods: Array<keyof InfraCoreLogger> = [
      'info',
      'success',
      'error',
      'warn',
      'debug',
      'newline',
      'generating',
      'running',
      'creating',
      'building',
      'checking',
      'complete',
    ];

    for (const method of methods) {
      expect(typeof defaultLogger[method]).toBe('function');
    }
  });
});

describe('InfraCoreError', () => {
  it('should set name to InfraCoreError', () => {
    const error = new InfraCoreError('test');
    expect(error.name).toBe('InfraCoreError');
  });

  it('should extend Error', () => {
    const error = new InfraCoreError('test');
    expect(error instanceof Error).toBe(true);
  });

  it('should store message, context, and hint', () => {
    const error = new InfraCoreError('msg', 'ctx', 'hint');
    expect(error.message).toBe('msg');
    expect(error.context).toBe('ctx');
    expect(error.hint).toBe('hint');
  });

  describe('format', () => {
    it('should format message only', () => {
      const error = new InfraCoreError('something broke');
      expect(error.format()).toBe('something broke');
    });

    it('should format context + message', () => {
      const error = new InfraCoreError(
        'something broke',
        'Terraform generation',
      );
      expect(error.format()).toBe('Terraform generation:\n\nsomething broke');
    });

    it('should format context + message + hint', () => {
      const error = new InfraCoreError(
        'something broke',
        'Terraform generation',
        'Check your config',
      );
      expect(error.format()).toBe(
        'Terraform generation:\n\nsomething broke\n\nCheck your config',
      );
    });
  });
});

describe('InfraConfig discriminated union', () => {
  const baseFields = {
    projectName: 'test-project',
    environment: 'dev',
    services: {},
    frontends: {},
    spas: {},
    workers: {},
    database: {
      tier: 'db-f1-micro',
      storageSizeGb: 10,
      deletionProtection: false,
      backup: false,
    },
    redis: { tier: 'basic' },
    servicesWithDatabase: [],
    baseDomain: 'example.com',
    scheduledJobs: {},
    allDeployables: {},
  };

  it('should narrow to AzureInfraConfig', () => {
    const config: InfraConfig = {
      ...baseFields,
      provider: 'azure',
      subscriptionId: 'sub-123',
      location: 'eastus',
      storageAccountName: 'testsa',
      frontdoorPremium: false,
      kongAppServiceSku: 'B1',
      nextjsAppServiceSku: 'B1',
    };

    if (config.provider === 'azure') {
      const azure: AzureInfraConfig = config;
      expect(azure.subscriptionId).toBe('sub-123');
      expect(azure.location).toBe('eastus');
      expect(azure.storageAccountName).toBe('testsa');
      expect(azure.frontdoorPremium).toBe(false);
      expect(azure.kongAppServiceSku).toBe('B1');
      expect(azure.nextjsAppServiceSku).toBe('B1');
    }
  });

  it('should narrow to AWSInfraConfig', () => {
    const config: InfraConfig = {
      ...baseFields,
      provider: 'aws',
      accountId: '123456789012',
      region: 'us-east-1',
      stateBucket: 'tf-state-bucket',
      lockTable: 'tf-lock-table',
    };

    if (config.provider === 'aws') {
      const aws: AWSInfraConfig = config;
      expect(aws.accountId).toBe('123456789012');
      expect(aws.region).toBe('us-east-1');
      expect(aws.stateBucket).toBe('tf-state-bucket');
      expect(aws.lockTable).toBe('tf-lock-table');
    }
  });

  it('should narrow to GCPInfraConfig', () => {
    const config: InfraConfig = {
      ...baseFields,
      provider: 'gcp',
      gcpProjectId: 'my-project-id',
      region: 'us-central1',
      stateBucket: 'tf-state-bucket',
    };

    if (config.provider === 'gcp') {
      const gcp: GCPInfraConfig = config;
      expect(gcp.gcpProjectId).toBe('my-project-id');
      expect(gcp.region).toBe('us-central1');
      expect(gcp.stateBucket).toBe('tf-state-bucket');
    }
  });

  it('should include optional provider-specific sub-type fields', () => {
    const config: InfraConfig = {
      ...baseFields,
      provider: 'aws',
      accountId: '123456789012',
      region: 'us-east-1',
      stateBucket: 'tf-state-bucket',
      lockTable: 'tf-lock-table',
      services: {
        'auth-service': {
          cpu: 256,
          memory: '512Mi',
          minInstances: 1,
          maxInstances: 4,
          dbPoolMax: 10,
        },
      },
      redis: { tier: 'cache.t3.micro', highAvailability: true },
    };

    expect(config.services['auth-service']?.dbPoolMax).toBe(10);
    expect(config.redis.highAvailability).toBe(true);
  });

  it('should include optional waf config', () => {
    const config: InfraConfig = {
      ...baseFields,
      provider: 'gcp',
      gcpProjectId: 'my-project-id',
      region: 'us-central1',
      stateBucket: 'tf-state-bucket',
      waf: {
        gcpCustomRules: [
          {
            name: 'block-scanners',
            priority: 800,
            action: 'deny(403)',
            expression: 'request.path.matches("/.env")',
          },
        ],
      },
    };

    expect(config.waf?.gcpCustomRules).toHaveLength(1);
    expect(config.waf?.gcpCustomRules?.[0]?.name).toBe('block-scanners');
  });
});
