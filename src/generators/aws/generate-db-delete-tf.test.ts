/**
 * Tests for generate-db-delete-tf
 */

import { describe, it, expect } from '@rstest/core';
import { generateDbDeleteTf } from './generate-db-delete-tf';

describe('generateDbDeleteTf', () => {
  describe('Standard use cases', () => {
    it('should generate terraform configuration', () => {
      const result = generateDbDeleteTf();

      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
    });

    it('should include ECR repository', () => {
      const result = generateDbDeleteTf();

      expect(result).toContain('resource "aws_ecr_repository" "db_delete"');
      expect(result).toContain(
        'name                 = "${var.project_name}/db-delete"',
      );
    });

    it('should include ECS task definition', () => {
      const result = generateDbDeleteTf();

      expect(result).toContain(
        'resource "aws_ecs_task_definition" "db_delete"',
      );
      expect(result).toContain(
        'family                   = "${var.project_name}-db-delete"',
      );
      expect(result).toContain('requires_compatibilities = ["FARGATE"]');
    });

    it('should include IAM role for task', () => {
      const result = generateDbDeleteTf();

      expect(result).toContain('resource "aws_iam_role" "db_delete_task"');
      expect(result).toContain('ReadMasterPassword');
      expect(result).toContain('secretsmanager:GetSecretValue');
    });

    it('should include CloudWatch log group with KMS', () => {
      const result = generateDbDeleteTf();

      expect(result).toContain(
        'resource "aws_cloudwatch_log_group" "db_delete"',
      );
      expect(result).toContain('kms_key_id        = aws_kms_key.logs.arn');
    });

    it('should reference master password secret', () => {
      const result = generateDbDeleteTf();

      expect(result).toContain(
        'aws_secretsmanager_secret.db_master_password.arn',
      );
    });
  });
});
