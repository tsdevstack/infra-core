import { describe, it, expect } from '@rstest/core';
import { generateTfvars } from './generate-tfvars';
import type { AWSInfraConfig } from '../../types/config.ts';

describe('generateTfvars', () => {
  const baseConfig: AWSInfraConfig = {
    provider: 'aws',
    projectName: 'my-app',
    environment: 'dev',
    accountId: '123456789012',
    region: 'us-east-1',
    stateBucket: 'my-app-terraform-state-123456789012',
    lockTable: 'my-app-terraform-locks',
    database: {
      tier: 'db.t3.micro',
      storageSizeGb: 20,
      deletionProtection: false,
      backup: false,
    },
    redis: { tier: 'cache.t3.micro', highAvailability: false },
    servicesWithDatabase: [],
    baseDomain: 'example.com',
    services: {},
    workers: {},
    allDeployables: {},
    spas: {},
    frontends: {},
    scheduledJobs: {},
  };

  describe('core values', () => {
    it('should set project_name', () => {
      const result = generateTfvars(baseConfig);
      expect(result).toContain('project_name   = "my-app"');
    });

    it('should set environment', () => {
      const result = generateTfvars(baseConfig);
      expect(result).toContain('environment    = "dev"');
    });

    it('should set aws_region', () => {
      const result = generateTfvars(baseConfig);
      expect(result).toContain('aws_region     = "us-east-1"');
    });

    it('should set aws_account_id', () => {
      const result = generateTfvars(baseConfig);
      expect(result).toContain('aws_account_id = "123456789012"');
    });

    it('should set base_domain', () => {
      const result = generateTfvars(baseConfig);
      expect(result).toContain('base_domain = "example.com"');
    });
  });

  describe('services map', () => {
    it('should output empty services map', () => {
      const result = generateTfvars(baseConfig);
      expect(result).toContain('services = {}');
    });

    it('should format services with resources', () => {
      const config: AWSInfraConfig = {
        ...baseConfig,
        services: {
          'auth-service': {
            cpu: 256,
            memory: '512',
            minInstances: 1,
            maxInstances: 4,
            dbPoolMax: 15,
          },
        },
      };
      const result = generateTfvars(config);
      expect(result).toContain('"auth-service" = {');
      expect(result).toContain('cpu          = 256');
      expect(result).toContain('memory       = 512');
      expect(result).toContain('minInstances = 1');
      expect(result).toContain('maxInstances = 4');
      expect(result).toContain('dbPoolMax    = 15');
    });

    it('should handle scale-to-zero services', () => {
      const config: AWSInfraConfig = {
        ...baseConfig,
        services: {
          'offers-service': {
            cpu: 256,
            memory: '512',
            minInstances: 0,
            maxInstances: 2,
            dbPoolMax: 50,
          },
        },
      };
      const result = generateTfvars(config);
      expect(result).toContain('minInstances = 0');
    });
  });

  describe('workers map', () => {
    it('should output empty workers map', () => {
      const result = generateTfvars(baseConfig);
      expect(result).toContain('workers = {}');
    });

    it('should format workers with base service and pool size', () => {
      const config: AWSInfraConfig = {
        ...baseConfig,
        workers: {
          'auth-worker': {
            cpu: 256,
            memory: '512',
            service: 'auth-service',
            dbPoolMax: 8,
          },
        },
      };
      const result = generateTfvars(config);
      expect(result).toContain('"auth-worker" = {');
      expect(result).toContain('service   = "auth-service"');
      expect(result).toContain('dbPoolMax = 8');
    });
  });

  describe('all_deployables map', () => {
    it('should output empty all_deployables map', () => {
      const result = generateTfvars(baseConfig);
      expect(result).toContain('all_deployables = {}');
    });

    it('should list all deployables', () => {
      const config: AWSInfraConfig = {
        ...baseConfig,
        allDeployables: {
          'auth-service': 'auth-service',
          kong: 'kong',
        },
      };
      const result = generateTfvars(config);
      expect(result).toContain('"auth-service" = "auth-service"');
      expect(result).toContain('"kong" = "kong"');
    });
  });

  describe('spa_services map', () => {
    it('should output empty spa_services map', () => {
      const result = generateTfvars(baseConfig);
      expect(result).toContain('spa_services = {}');
    });

    it('should format SPA services with domain', () => {
      const config: AWSInfraConfig = {
        ...baseConfig,
        spas: {
          frontend: { domain: 'app.example.com' },
        },
      };
      const result = generateTfvars(config);
      expect(result).toContain('"frontend" = {');
      expect(result).toContain('domain = "app.example.com"');
    });
  });

  describe('nextjs_services map', () => {
    it('should output empty nextjs_services map', () => {
      const result = generateTfvars(baseConfig);
      expect(result).toContain('nextjs_services = {}');
    });

    it('should format Next.js services with all properties', () => {
      const config: AWSInfraConfig = {
        ...baseConfig,
        frontends: {
          'admin-portal': {
            domain: 'admin.example.com',
            cpu: 256,
            memory: '512',
            minInstances: 1,
            maxInstances: 3,
          },
        },
      };
      const result = generateTfvars(config);
      expect(result).toContain('"admin-portal" = {');
      expect(result).toContain('domain       = "admin.example.com"');
      expect(result).toContain('cpu          = 256');
    });
  });

  describe('scheduled_jobs map', () => {
    it('should output empty scheduled_jobs map', () => {
      const result = generateTfvars(baseConfig);
      expect(result).toContain('scheduled_jobs = {}');
    });

    it('should format scheduled jobs', () => {
      const config: AWSInfraConfig = {
        ...baseConfig,
        scheduledJobs: {
          'auth-service-cleanup': {
            name: 'auth-service-cleanup',
            schedule: 'cron(0 * * * ? *)',
            targetService: 'auth-service',
            endpoint: '/api/internal/cleanup',
          },
        },
      };
      const result = generateTfvars(config);
      expect(result).toContain('"auth-service-cleanup" = {');
      expect(result).toContain('schedule    = "cron(0 * * * ? *)"');
      expect(result).toContain('serviceName = "auth-service"');
      expect(result).toContain('path        = "/api/internal/cleanup"');
    });
  });

  describe('database settings', () => {
    it('should set database instance class', () => {
      const result = generateTfvars(baseConfig);
      expect(result).toContain('db_instance_class            = "db.t3.micro"');
    });

    it('should set database storage size', () => {
      const result = generateTfvars(baseConfig);
      expect(result).toContain('database_storage_size        = 20');
    });

    it('should set deletion protection', () => {
      const result = generateTfvars(baseConfig);
      expect(result).toContain('database_deletion_protection = false');
    });

    it('should set backup enabled/disabled', () => {
      const result = generateTfvars(baseConfig);
      expect(result).toContain('database_backup              = false');
    });
  });

  describe('redis settings', () => {
    it('should set redis node type', () => {
      const result = generateTfvars(baseConfig);
      expect(result).toContain('redis_node_type         = "cache.t3.micro"');
    });

    it('should set high availability', () => {
      const result = generateTfvars(baseConfig);
      expect(result).toContain('redis_high_availability = false');
    });

    it('should enable HA when configured', () => {
      const config: AWSInfraConfig = {
        ...baseConfig,
        redis: { tier: 'cache.t3.small', highAvailability: true },
      };
      const result = generateTfvars(config);
      expect(result).toContain('redis_high_availability = true');
    });
  });

  describe('header comment', () => {
    it('should include generation comment', () => {
      const result = generateTfvars(baseConfig);
      expect(result).toContain('Generated by: npx tsdevstack infra:generate');
    });
  });

  describe('snapshot', () => {
    it('should match snapshot for minimal config', () => {
      const result = generateTfvars(baseConfig);
      expect(result).toMatchSnapshot();
    });

    it('should match snapshot for full config', () => {
      const fullConfig: AWSInfraConfig = {
        ...baseConfig,
        services: {
          'auth-service': {
            cpu: 256,
            memory: '512',
            minInstances: 1,
            maxInstances: 4,
            dbPoolMax: 18,
          },
          'bff-service': {
            cpu: 512,
            memory: '1024',
            minInstances: 0,
            maxInstances: 2,
            dbPoolMax: 37,
          },
          kong: {
            cpu: 256,
            memory: '512',
            minInstances: 1,
            maxInstances: 4,
            dbPoolMax: 0,
          },
        },
        workers: {
          'auth-worker': {
            cpu: 256,
            memory: '512',
            service: 'auth-service',
            dbPoolMax: 8,
          },
        },
        allDeployables: {
          'auth-service': 'auth-service',
          'bff-service': 'bff-service',
          kong: 'kong',
          'auth-worker': 'auth-worker',
        },
        spas: {
          frontend: { domain: 'app.example.com' },
        },
        frontends: {
          'admin-portal': {
            domain: 'admin.example.com',
            cpu: 256,
            memory: '512',
            minInstances: 1,
            maxInstances: 3,
          },
        },
        scheduledJobs: {
          'auth-service-cleanup': {
            name: 'auth-service-cleanup',
            schedule: 'cron(0 * * * ? *)',
            targetService: 'auth-service',
            endpoint: '/api/internal/cleanup',
          },
        },
      };
      const result = generateTfvars(fullConfig);
      expect(result).toMatchSnapshot();
    });
  });
});
