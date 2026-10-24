import { describe, it, expect } from '@rstest/core';
import { generateDatabaseTf } from './generate-database-tf';

describe('generateDatabaseTf', () => {
  describe('DB subnet group', () => {
    it('should create db subnet group resource', () => {
      const result = generateDatabaseTf();
      expect(result).toContain('resource "aws_db_subnet_group" "main"');
    });

    it('should use private subnets', () => {
      const result = generateDatabaseTf();
      expect(result).toContain('subnet_ids  = aws_subnet.private[*].id');
    });

    it('should use project name in subnet group name', () => {
      const result = generateDatabaseTf();
      expect(result).toContain('name        = "${var.project_name}-db"');
    });
  });

  describe('master password', () => {
    it('should create random password resource', () => {
      const result = generateDatabaseTf();
      expect(result).toContain('resource "random_password" "db_master"');
    });

    it('should generate 32 character password', () => {
      const result = generateDatabaseTf();
      expect(result).toContain('length  = 32');
    });

    it('should not include special characters', () => {
      const result = generateDatabaseTf();
      expect(result).toContain('special = false');
    });
  });

  describe('RDS instance', () => {
    it('should create RDS instance resource', () => {
      const result = generateDatabaseTf();
      expect(result).toContain('resource "aws_db_instance" "main"');
    });

    it('should use postgres engine', () => {
      const result = generateDatabaseTf();
      expect(result).toContain('engine         = "postgres"');
    });

    it('should use postgres version 15', () => {
      const result = generateDatabaseTf();
      expect(result).toContain('engine_version = "15"');
    });

    it('should use instance class variable', () => {
      const result = generateDatabaseTf();
      expect(result).toContain('instance_class = var.db_instance_class');
    });

    it('should use postgres as db name and username', () => {
      const result = generateDatabaseTf();
      expect(result).toContain('db_name  = "postgres"');
      expect(result).toContain('username = "postgres"');
    });

    it('should use generated password', () => {
      const result = generateDatabaseTf();
      expect(result).toContain('password = random_password.db_master.result');
    });

    it('should not be publicly accessible', () => {
      const result = generateDatabaseTf();
      expect(result).toContain('publicly_accessible    = false');
    });

    it('should enable storage encryption', () => {
      const result = generateDatabaseTf();
      expect(result).toContain('storage_encrypted     = true');
    });

    it('should size storage from the database_storage_size variable', () => {
      const result = generateDatabaseTf();
      expect(result).toContain(
        'allocated_storage     = var.database_storage_size',
      );
      expect(result).toContain(
        'max_allocated_storage = max(100, var.database_storage_size * 2)',
      );
      expect(result).not.toContain('allocated_storage     = 20');
    });

    it('should use gp3 storage type', () => {
      const result = generateDatabaseTf();
      expect(result).toContain('storage_type          = "gp3"');
    });

    it('should use deletion protection variable', () => {
      const result = generateDatabaseTf();
      expect(result).toContain(
        'deletion_protection       = var.database_deletion_protection',
      );
    });

    it('should run Multi-AZ from the database_ha variable', () => {
      const result = generateDatabaseTf();
      expect(result).toContain('multi_az               = var.database_ha');
    });

    it('should turn automated backups off when database_backup is false', () => {
      const result = generateDatabaseTf();
      expect(result).toContain(
        'backup_retention_period   = var.database_backup ? 7 : 0',
      );
      expect(result).toContain(
        'backup_window             = var.database_backup ? "03:00-04:00" : null',
      );
    });

    it('should not skip final snapshot', () => {
      const result = generateDatabaseTf();
      expect(result).toContain('skip_final_snapshot       = false');
    });

    it('should give the final snapshot a unique name', () => {
      const result = generateDatabaseTf();
      expect(result).toContain('resource "random_id" "db_final_snapshot"');
      expect(result).toContain(
        'final_snapshot_identifier = "${var.project_name}-db-final-${random_id.db_final_snapshot.hex}"',
      );
    });

    it('should use RDS security group', () => {
      const result = generateDatabaseTf();
      expect(result).toContain(
        'vpc_security_group_ids = [aws_security_group.rds.id]',
      );
    });
  });

  describe('secrets manager', () => {
    it('should create secret for master password', () => {
      const result = generateDatabaseTf();
      expect(result).toContain(
        'resource "aws_secretsmanager_secret" "db_master_password"',
      );
    });

    it('should delete the secret without a recovery window', () => {
      const result = generateDatabaseTf();
      expect(result).toContain('recovery_window_in_days = 0');
    });

    it('should create secret version with password', () => {
      const result = generateDatabaseTf();
      expect(result).toContain(
        'resource "aws_secretsmanager_secret_version" "db_master_password"',
      );
      expect(result).toContain(
        'secret_string = random_password.db_master.result',
      );
    });
  });

  describe('header comment', () => {
    it('should include generation comment', () => {
      const result = generateDatabaseTf();
      expect(result).toContain('Generated by: npx tsdevstack infra:generate');
    });
  });

  describe('snapshot', () => {
    it('should match snapshot', () => {
      const result = generateDatabaseTf();
      expect(result).toMatchSnapshot();
    });
  });
});
