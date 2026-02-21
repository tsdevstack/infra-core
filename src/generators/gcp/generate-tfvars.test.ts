import { describe, it, expect } from '@rstest/core';
import { generateTfvars } from './generate-tfvars';
import type { GCPInfraConfig } from '../../types/index.ts';

describe('generateTfvars', () => {
  const baseConfig: GCPInfraConfig = {
    provider: 'gcp',
    projectName: 'my-app',
    environment: 'dev',
    gcpProjectId: 'gcp-project-123',
    region: 'us-central1',
    stateBucket: 'my-app-tf-state',
    baseDomain: 'example.com',
    database: {
      tier: 'db-f1-micro',
      storageSizeGb: 10,
      deletionProtection: true,
      ha: false,
      backup: false,
    },
    redis: { tier: 'BASIC', memoryGb: 1 },
    servicesWithDatabase: [],
    services: {},
    frontends: {},
    spas: {},
    workers: {},
    scheduledJobs: {},
    allDeployables: {},
  };

  describe('core values', () => {
    it('should set project_name', () => {
      const result = generateTfvars(baseConfig);
      expect(result).toContain('project_name   = "my-app"');
    });

    it('should set gcp_project_id', () => {
      const result = generateTfvars(baseConfig);
      expect(result).toContain('gcp_project_id = "gcp-project-123"');
    });

    it('should set gcp_region', () => {
      const result = generateTfvars(baseConfig);
      expect(result).toContain('gcp_region     = "us-central1"');
    });
  });

  describe('database values', () => {
    it('should set database_deletion_protection', () => {
      const result = generateTfvars(baseConfig);
      expect(result).toContain('database_deletion_protection = true');
    });

    it('should set database_deletion_protection to false when configured', () => {
      const config: GCPInfraConfig = {
        ...baseConfig,
        database: { ...baseConfig.database, deletionProtection: false },
      };
      const result = generateTfvars(config);
      expect(result).toContain('database_deletion_protection = false');
    });

    it('should set database_tier', () => {
      const result = generateTfvars(baseConfig);
      expect(result).toContain('database_tier                = "db-f1-micro"');
    });

    it('should set database_disk_size', () => {
      const result = generateTfvars(baseConfig);
      expect(result).toContain('database_disk_size           = 10');
    });

    it('should set database_ha to false', () => {
      const result = generateTfvars(baseConfig);
      expect(result).toContain('database_ha                  = false');
    });

    it('should set database_backup to false', () => {
      const result = generateTfvars(baseConfig);
      expect(result).toContain('database_backup              = false');
    });

    it('should reflect production database configuration', () => {
      const prodConfig: GCPInfraConfig = {
        ...baseConfig,
        database: {
          tier: 'db-custom-4-16384',
          storageSizeGb: 500,
          deletionProtection: true,
          ha: true,
          backup: true,
        },
      };
      const result = generateTfvars(prodConfig);
      expect(result).toContain(
        'database_tier                = "db-custom-4-16384"',
      );
      expect(result).toContain('database_disk_size           = 500');
      expect(result).toContain('database_ha                  = true');
      expect(result).toContain('database_backup              = true');
    });
  });

  describe('redis values', () => {
    it('should set redis_tier', () => {
      const result = generateTfvars(baseConfig);
      expect(result).toContain('redis_tier      = "BASIC"');
    });

    it('should set redis_memory_gb', () => {
      const result = generateTfvars(baseConfig);
      expect(result).toContain('redis_memory_gb = 1');
    });

    it('should reflect production redis configuration', () => {
      const prodConfig: GCPInfraConfig = {
        ...baseConfig,
        redis: { tier: 'STANDARD_HA', memoryGb: 16 },
      };
      const result = generateTfvars(prodConfig);
      expect(result).toContain('redis_tier      = "STANDARD_HA"');
      expect(result).toContain('redis_memory_gb = 16');
    });
  });

  describe('different configurations', () => {
    it('should generate correct values for production config', () => {
      const prodConfig: GCPInfraConfig = {
        ...baseConfig,
        projectName: 'production-app',
        environment: 'prod',
        gcpProjectId: 'prod-gcp-12345',
        region: 'europe-west1',
        stateBucket: 'production-app-tf-state',
        database: {
          tier: 'db-custom-8-32768',
          storageSizeGb: 1000,
          deletionProtection: true,
          ha: true,
          backup: true,
        },
        redis: { tier: 'STANDARD_HA', memoryGb: 32 },
      };
      const result = generateTfvars(prodConfig);

      expect(result).toContain('project_name   = "production-app"');
      expect(result).toContain('gcp_project_id = "prod-gcp-12345"');
      expect(result).toContain('gcp_region     = "europe-west1"');
      expect(result).toContain(
        'database_tier                = "db-custom-8-32768"',
      );
      expect(result).toContain('database_disk_size           = 1000');
      expect(result).toContain('database_ha                  = true');
      expect(result).toContain('database_backup              = true');
      expect(result).toContain('redis_tier      = "STANDARD_HA"');
      expect(result).toContain('redis_memory_gb = 32');
    });
  });

  describe('header comment', () => {
    it('should include generation comment', () => {
      const result = generateTfvars(baseConfig);
      expect(result).toContain('Generated by: npx tsdevstack infra:generate');
    });
  });

  describe('snapshots', () => {
    it('should match snapshot for dev config', () => {
      const result = generateTfvars(baseConfig);
      expect(result).toMatchSnapshot();
    });

    it('should match snapshot for prod config', () => {
      const prodConfig: GCPInfraConfig = {
        ...baseConfig,
        projectName: 'my-app',
        environment: 'prod',
        gcpProjectId: 'my-app-prod-123',
        region: 'us-east1',
        stateBucket: 'my-app-tf-state',
        database: {
          tier: 'db-custom-2-8192',
          storageSizeGb: 100,
          deletionProtection: true,
          ha: true,
          backup: true,
        },
        redis: { tier: 'STANDARD_HA', memoryGb: 8 },
      };
      const result = generateTfvars(prodConfig);
      expect(result).toMatchSnapshot();
    });
  });
});
