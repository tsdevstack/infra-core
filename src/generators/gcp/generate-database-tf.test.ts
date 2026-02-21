import { describe, it, expect } from '@rstest/core';
import { generateDatabaseTf } from './generate-database-tf';
import type { GCPInfraConfig } from '../../types/index.ts';

describe('generateDatabaseTf', () => {
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
    servicesWithDatabase: [{ name: 'auth-service', hasDatabase: true }],
    services: {},
    frontends: {},
    spas: {},
    workers: {},
    scheduledJobs: {},
    allDeployables: {},
  };

  describe('Cloud SQL instance', () => {
    it('should create Cloud SQL PostgreSQL instance', () => {
      const result = generateDatabaseTf(baseConfig);
      expect(result).toContain(
        'resource "google_sql_database_instance" "postgres"',
      );
    });

    it('should use PostgreSQL 15', () => {
      const result = generateDatabaseTf(baseConfig);
      expect(result).toContain('database_version = "POSTGRES_15"');
    });

    it('should use variable for deletion protection', () => {
      const result = generateDatabaseTf(baseConfig);
      expect(result).toContain(
        'deletion_protection = var.database_deletion_protection',
      );
    });

    it('should use variable for database tier', () => {
      const result = generateDatabaseTf(baseConfig);
      expect(result).toContain('tier              = var.database_tier');
    });

    it('should use variable for disk size', () => {
      const result = generateDatabaseTf(baseConfig);
      expect(result).toContain('disk_size         = var.database_disk_size');
    });

    it('should enable disk autoresize', () => {
      const result = generateDatabaseTf(baseConfig);
      expect(result).toContain('disk_autoresize   = true');
    });

    it('should use SSD disk type', () => {
      const result = generateDatabaseTf(baseConfig);
      expect(result).toContain('disk_type         = "PD_SSD"');
    });
  });

  describe('IP configuration', () => {
    it('should disable public IP', () => {
      const result = generateDatabaseTf(baseConfig);
      expect(result).toContain('ipv4_enabled    = false');
    });

    it('should connect to VPC network', () => {
      const result = generateDatabaseTf(baseConfig);
      expect(result).toContain(
        'private_network = google_compute_network.vpc.id',
      );
    });
  });

  describe('backup configuration', () => {
    it('should use variable for backup enabled', () => {
      const result = generateDatabaseTf(baseConfig);
      expect(result).toContain(
        'enabled                        = var.database_backup',
      );
    });

    it('should configure backup start time', () => {
      const result = generateDatabaseTf(baseConfig);
      expect(result).toContain('start_time                     = "03:00"');
    });
  });

  describe('maintenance window', () => {
    it('should configure maintenance on Sunday', () => {
      const result = generateDatabaseTf(baseConfig);
      expect(result).toContain('day          = 7');
    });

    it('should use stable update track', () => {
      const result = generateDatabaseTf(baseConfig);
      expect(result).toContain('update_track = "stable"');
    });
  });

  describe('query insights', () => {
    it('should enable query insights', () => {
      const result = generateDatabaseTf(baseConfig);
      expect(result).toContain('query_insights_enabled  = true');
    });
  });

  describe('per-service databases', () => {
    it('should create database for each service with hasDatabase=true', () => {
      const config: GCPInfraConfig = {
        ...baseConfig,
        servicesWithDatabase: [
          { name: 'auth-service', hasDatabase: true },
          { name: 'api-service', hasDatabase: true },
        ],
      };
      const result = generateDatabaseTf(config);
      expect(result).toContain('resource "google_sql_database" "auth_service"');
      expect(result).toContain('resource "google_sql_database" "api_service"');
      expect(result).toContain('name     = "auth-service"');
      expect(result).toContain('name     = "api-service"');
    });

    it('should not create database for services without hasDatabase', () => {
      const config: GCPInfraConfig = {
        ...baseConfig,
        servicesWithDatabase: [
          { name: 'auth-service', hasDatabase: true },
          { name: 'bff-service', hasDatabase: false },
        ],
      };
      const result = generateDatabaseTf(config);
      expect(result).toContain('resource "google_sql_database" "auth_service"');
      expect(result).not.toContain(
        'resource "google_sql_database" "bff_service"',
      );
    });

    it('should handle no services with databases', () => {
      const config: GCPInfraConfig = {
        ...baseConfig,
        servicesWithDatabase: [],
      };
      const result = generateDatabaseTf(config);
      expect(result).not.toContain('google_sql_database"');
      // Should still have the instance
      expect(result).toContain('google_sql_database_instance');
    });

    it('should convert service names with hyphens to underscores for terraform IDs', () => {
      const config: GCPInfraConfig = {
        ...baseConfig,
        servicesWithDatabase: [{ name: 'my-cool-service', hasDatabase: true }],
      };
      const result = generateDatabaseTf(config);
      expect(result).toContain(
        'resource "google_sql_database" "my_cool_service"',
      );
      expect(result).toContain('name     = "my-cool-service"');
    });
  });

  describe('database users', () => {
    it('should create database user per service with hasDatabase', () => {
      const result = generateDatabaseTf(baseConfig);
      // auth-service has hasDatabase: true
      expect(result).toContain(
        'resource "google_sql_user" "auth_service_user"',
      );
    });

    it('should use service name for user name', () => {
      const result = generateDatabaseTf(baseConfig);
      expect(result).toContain('name     = "auth-service"');
    });

    it('should use password variable from Secret Manager', () => {
      const result = generateDatabaseTf(baseConfig);
      expect(result).toContain('password = var.db_auth_password');
    });

    it('should include comment about password sources', () => {
      const result = generateDatabaseTf(baseConfig);
      expect(result).toContain('TF_VAR_db_{prefix}_password');
      expect(result).toContain('cloud-secrets:get');
    });
  });

  describe('dependencies', () => {
    it('should depend on private service connection', () => {
      const result = generateDatabaseTf(baseConfig);
      expect(result).toContain(
        'depends_on = [google_service_networking_connection.private_service_connection]',
      );
    });
  });

  describe('header comment', () => {
    it('should include generation comment', () => {
      const result = generateDatabaseTf(baseConfig);
      expect(result).toContain('Generated by: npx tsdevstack infra:generate');
    });
  });

  describe('snapshots', () => {
    it('should match snapshot with single service database', () => {
      const result = generateDatabaseTf(baseConfig);
      expect(result).toMatchSnapshot();
    });

    it('should match snapshot with multiple service databases', () => {
      const config: GCPInfraConfig = {
        ...baseConfig,
        servicesWithDatabase: [
          { name: 'auth-service', hasDatabase: true },
          { name: 'offers-service', hasDatabase: true },
          { name: 'bff-service', hasDatabase: false },
        ],
      };
      const result = generateDatabaseTf(config);
      expect(result).toMatchSnapshot();
    });

    it('should match snapshot with no service databases', () => {
      const config: GCPInfraConfig = {
        ...baseConfig,
        servicesWithDatabase: [],
      };
      const result = generateDatabaseTf(config);
      expect(result).toMatchSnapshot();
    });
  });
});
