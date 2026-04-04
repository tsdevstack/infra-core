import { describe, it, expect } from '@rstest/core';
import { generateVariablesTf } from './generate-variables-tf';

describe('generateVariablesTf', () => {
  describe('core variables', () => {
    it('should define project_name variable', () => {
      const result = generateVariablesTf([]);
      expect(result).toContain('variable "project_name"');
      expect(result).toContain('type        = string');
    });

    it('should define environment variable', () => {
      const result = generateVariablesTf([]);
      expect(result).toContain('variable "environment"');
    });

    it('should define aws_region variable', () => {
      const result = generateVariablesTf([]);
      expect(result).toContain('variable "aws_region"');
    });

    it('should define aws_account_id variable', () => {
      const result = generateVariablesTf([]);
      expect(result).toContain('variable "aws_account_id"');
    });
  });

  describe('domain variables', () => {
    it('should define base_domain variable', () => {
      const result = generateVariablesTf([]);
      expect(result).toContain('variable "base_domain"');
    });
  });

  describe('service variables', () => {
    it('should define services map variable', () => {
      const result = generateVariablesTf([]);
      expect(result).toContain('variable "services"');
      expect(result).toContain('cpu          = number');
      expect(result).toContain('memory       = number');
      expect(result).toContain('minInstances = number');
      expect(result).toContain('maxInstances = number');
      expect(result).toContain('dbPoolMax    = number');
    });

    it('should define workers map variable with default', () => {
      const result = generateVariablesTf([]);
      expect(result).toContain('variable "workers"');
      expect(result).toContain('service      = string');
      expect(result).toContain('dbPoolMax    = number');
      expect(result).toContain('default = {}');
    });

    it('should define all_deployables map variable', () => {
      const result = generateVariablesTf([]);
      expect(result).toContain('variable "all_deployables"');
      expect(result).toContain('type        = map(string)');
    });
  });

  describe('SPA variables', () => {
    it('should define spa_services map variable', () => {
      const result = generateVariablesTf([]);
      expect(result).toContain('variable "spa_services"');
      expect(result).toContain('domain = string');
    });
  });

  describe('Next.js variables', () => {
    it('should define nextjs_services map variable', () => {
      const result = generateVariablesTf([]);
      expect(result).toContain('variable "nextjs_services"');
    });
  });

  describe('scheduled jobs variables', () => {
    it('should define scheduled_jobs map variable', () => {
      const result = generateVariablesTf([]);
      expect(result).toContain('variable "scheduled_jobs"');
      expect(result).toContain('schedule    = string');
      expect(result).toContain('serviceName = string');
      expect(result).toContain('path        = string');
    });
  });

  describe('database variables', () => {
    it('should define db_instance_class with default', () => {
      const result = generateVariablesTf([]);
      expect(result).toContain('variable "db_instance_class"');
      expect(result).toContain('default     = "db.t3.micro"');
    });

    it('should define database_storage_size with default', () => {
      const result = generateVariablesTf([]);
      expect(result).toContain('variable "database_storage_size"');
      expect(result).toContain('default     = 20');
    });

    it('should define database_deletion_protection with default true', () => {
      const result = generateVariablesTf([]);
      expect(result).toContain('variable "database_deletion_protection"');
      expect(result).toContain('type        = bool');
    });

    it('should define database_backup variable', () => {
      const result = generateVariablesTf([]);
      expect(result).toContain('variable "database_backup"');
    });
  });

  describe('redis variables', () => {
    it('should define redis_node_type with default', () => {
      const result = generateVariablesTf([]);
      expect(result).toContain('variable "redis_node_type"');
      expect(result).toContain('default     = "cache.t3.micro"');
    });

    it('should define redis_high_availability with default false', () => {
      const result = generateVariablesTf([]);
      expect(result).toContain('variable "redis_high_availability"');
      expect(result).toContain('default     = false');
    });
  });

  describe('deployed origins variables', () => {
    it('should define spa_buckets_ready for CloudFront', () => {
      const result = generateVariablesTf([]);
      expect(result).toContain('variable "spa_buckets_ready"');
      expect(result).toContain('type        = map(bool)');
    });
  });

  describe('header comment', () => {
    it('should include generation comment', () => {
      const result = generateVariablesTf([]);
      expect(result).toContain('Generated by: npx tsdevstack infra:generate');
    });
  });

  describe('snapshot', () => {
    it('should match snapshot', () => {
      const result = generateVariablesTf([]);
      expect(result).toMatchSnapshot();
    });

    it('should match snapshot with services that have databases', () => {
      const result = generateVariablesTf([
        { name: 'auth-service', hasDatabase: true },
        { name: 'offers-service', hasDatabase: true },
        { name: 'bff-service', hasDatabase: false },
      ]);
      // Note: servicesWithDatabase is no longer used, so output should be same
      expect(result).toMatchSnapshot();
    });
  });
});
