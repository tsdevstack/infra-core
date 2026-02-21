import { describe, it, expect } from '@rstest/core';
import { generateVariablesTf } from './generate-variables-tf';

// Default empty services for tests that don't need password variables
const noServices: { name: string; hasDatabase: boolean }[] = [];

// Services with databases for password variable tests
const servicesWithDb = [
  { name: 'auth-service', hasDatabase: true },
  { name: 'offers-service', hasDatabase: true },
  { name: 'bff-service', hasDatabase: false },
];

describe('generateVariablesTf', () => {
  describe('core variables', () => {
    it('should define project_name variable', () => {
      const result = generateVariablesTf(noServices);
      expect(result).toContain('variable "project_name"');
      expect(result).toContain('type        = string');
    });

    it('should define gcp_project_id variable', () => {
      const result = generateVariablesTf(noServices);
      expect(result).toContain('variable "gcp_project_id"');
    });

    it('should define gcp_region variable', () => {
      const result = generateVariablesTf(noServices);
      expect(result).toContain('variable "gcp_region"');
    });
  });

  describe('database variables', () => {
    it('should define database_deletion_protection variable with default true', () => {
      const result = generateVariablesTf(noServices);
      expect(result).toContain('variable "database_deletion_protection"');
      expect(result).toContain('type        = bool');
      expect(result).toContain('default     = true');
    });

    it('should define database_tier variable', () => {
      const result = generateVariablesTf(noServices);
      expect(result).toContain('variable "database_tier"');
      expect(result).toContain('default     = "db-f1-micro"');
    });

    it('should define database_disk_size variable', () => {
      const result = generateVariablesTf(noServices);
      expect(result).toContain('variable "database_disk_size"');
      expect(result).toContain('default     = 10');
    });

    it('should define database_ha variable', () => {
      const result = generateVariablesTf(noServices);
      expect(result).toContain('variable "database_ha"');
      expect(result).toContain('type        = bool');
      expect(result).toContain('default     = false');
    });

    it('should define database_backup variable', () => {
      const result = generateVariablesTf(noServices);
      expect(result).toContain('variable "database_backup"');
      expect(result).toContain('type        = bool');
    });
  });

  describe('database password variables', () => {
    it('should generate password variable for services with database', () => {
      const result = generateVariablesTf(servicesWithDb);
      expect(result).toContain('variable "db_auth_password"');
      expect(result).toContain('variable "db_offers_password"');
    });

    it('should NOT generate password variable for services without database', () => {
      const result = generateVariablesTf(servicesWithDb);
      expect(result).not.toContain('variable "db_bff_password"');
    });

    it('should mark password variables as sensitive', () => {
      const result = generateVariablesTf(servicesWithDb);
      expect(result).toContain('sensitive   = true');
    });

    it('should include service name in description', () => {
      const result = generateVariablesTf(servicesWithDb);
      expect(result).toContain('Database password for auth-service');
      expect(result).toContain('Database password for offers-service');
    });

    it('should generate no db password variables when no services have databases', () => {
      const result = generateVariablesTf(noServices);
      expect(result).not.toContain('db_');
    });
  });

  describe('redis variables', () => {
    it('should define redis_tier variable', () => {
      const result = generateVariablesTf(noServices);
      expect(result).toContain('variable "redis_tier"');
      expect(result).toContain('default     = "BASIC"');
    });

    it('should define redis_memory_gb variable', () => {
      const result = generateVariablesTf(noServices);
      expect(result).toContain('variable "redis_memory_gb"');
      expect(result).toContain('default     = 1');
    });

    it('should NOT define redis_auth_string variable (GCP auto-generates it)', () => {
      const result = generateVariablesTf(noServices);
      expect(result).not.toContain('variable "redis_auth_string"');
    });
  });

  describe('variable descriptions', () => {
    it('should include descriptions for all variables', () => {
      const result = generateVariablesTf(noServices);
      // Count occurrences of 'description'
      const descriptionCount = (result.match(/description\s*=/g) || []).length;
      // Should have at least one description per variable (8 variables without db passwords)
      expect(descriptionCount).toBeGreaterThanOrEqual(8);
    });
  });

  describe('header comment', () => {
    it('should include generation comment', () => {
      const result = generateVariablesTf(noServices);
      expect(result).toContain('Generated by: npx tsdevstack infra:generate');
    });
  });

  describe('snapshot', () => {
    it('should match snapshot without services', () => {
      const result = generateVariablesTf(noServices);
      expect(result).toMatchSnapshot();
    });

    it('should match snapshot with services', () => {
      const result = generateVariablesTf(servicesWithDb);
      expect(result).toMatchSnapshot();
    });
  });
});
