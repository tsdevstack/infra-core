import { describe, it, expect } from '@rstest/core';
import { generateEcsTf } from './generate-ecs-tf';

describe('generateEcsTf', () => {
  describe('ECS cluster', () => {
    it('should create ECS cluster', () => {
      const result = generateEcsTf();
      expect(result).toContain('resource "aws_ecs_cluster" "main"');
    });

    it('should enable container insights', () => {
      const result = generateEcsTf();
      expect(result).toContain('name  = "containerInsights"');
      expect(result).toContain('value = "enabled"');
    });

    it('should use project name in cluster name', () => {
      const result = generateEcsTf();
      expect(result).toContain('name = "${var.project_name}-cluster"');
    });
  });

  describe('CloudWatch log groups', () => {
    it('should create log groups for services', () => {
      const result = generateEcsTf();
      expect(result).toContain('resource "aws_cloudwatch_log_group" "service"');
      expect(result).toContain('for_each          = var.services');
    });

    it('should create log groups for workers', () => {
      const result = generateEcsTf();
      expect(result).toContain('resource "aws_cloudwatch_log_group" "worker"');
      expect(result).toContain('for_each          = var.workers');
    });

    it('should retain logs for 30 days', () => {
      const result = generateEcsTf();
      expect(result).toContain('retention_in_days = 30');
    });

    it('should use /ecs/ prefix for log group names', () => {
      const result = generateEcsTf();
      expect(result).toContain(
        'name              = "/ecs/${var.project_name}/${each.key}"',
      );
    });
  });

  describe('task definitions', () => {
    it('should create task definitions for services', () => {
      const result = generateEcsTf();
      expect(result).toContain('resource "aws_ecs_task_definition" "service"');
    });

    it('should use Fargate compatibility', () => {
      const result = generateEcsTf();
      expect(result).toContain('requires_compatibilities = ["FARGATE"]');
    });

    it('should use awsvpc network mode', () => {
      const result = generateEcsTf();
      expect(result).toContain('network_mode             = "awsvpc"');
    });

    it('should use execution role', () => {
      const result = generateEcsTf();
      expect(result).toContain(
        'execution_role_arn       = aws_iam_role.ecs_execution.arn',
      );
    });

    it('should use per-service task role', () => {
      const result = generateEcsTf();
      expect(result).toContain(
        'task_role_arn            = aws_iam_role.task[each.key].arn',
      );
    });

    it('should expose port 8080', () => {
      const result = generateEcsTf();
      expect(result).toContain('containerPort = 8080');
    });

    it('should set NODE_ENV to production', () => {
      const result = generateEcsTf();
      expect(result).toContain('name = "NODE_ENV", value = "production"');
    });

    it('should include CLOUD_PROVIDER aws', () => {
      const result = generateEcsTf();
      expect(result).toContain('name = "CLOUD_PROVIDER", value = "aws"');
    });

    it('should include SECRETS_PROVIDER aws', () => {
      const result = generateEcsTf();
      expect(result).toContain('name = "SECRETS_PROVIDER", value = "aws"');
    });

    it('should include SERVICE_NAME', () => {
      const result = generateEcsTf();
      expect(result).toContain('name = "SERVICE_NAME", value = each.key');
    });
  });

  describe('DB_POOL_MAX', () => {
    it('should use dynamic pool size from config for services', () => {
      const result = generateEcsTf();
      expect(result).not.toContain('value = "10"');
      expect(result).toContain(
        '{ name = "DB_POOL_MAX", value = tostring(each.value.dbPoolMax) }',
      );
    });
  });

  describe('task definitions for workers', () => {
    it('should create task definitions for workers', () => {
      const result = generateEcsTf();
      expect(result).toContain('resource "aws_ecs_task_definition" "worker"');
    });
  });

  describe('ECS services', () => {
    it('should create ECS services using for_each', () => {
      const result = generateEcsTf();
      expect(result).toContain('resource "aws_ecs_service" "service"');
      expect(result).toContain('for_each = var.services');
    });

    it('should use Fargate launch type', () => {
      const result = generateEcsTf();
      expect(result).toContain('launch_type     = "FARGATE"');
    });

    it('should configure load balancer integration', () => {
      const result = generateEcsTf();
      expect(result).toContain('load_balancer {');
      expect(result).toContain('container_port   = 8080');
    });

    it('should enable zero-downtime deployment', () => {
      const result = generateEcsTf();
      // Uses rolling deployment instead of circuit breaker
      expect(result).toContain('deployment_minimum_healthy_percent = 100');
      expect(result).toContain('deployment_maximum_percent         = 200');
    });
  });

  describe('ECS services for workers', () => {
    it('should create ECS services for workers', () => {
      const result = generateEcsTf();
      expect(result).toContain('resource "aws_ecs_service" "worker"');
      expect(result).toContain('for_each = var.workers');
    });
  });

  describe('Cloud Map service discovery', () => {
    // Note: Cloud Map namespace is created in generate-network-tf.ts, not here

    it('should register backend services with Cloud Map (excludes Kong)', () => {
      const result = generateEcsTf();
      // Uses dynamic block to conditionally add service_registries for non-Kong services
      expect(result).toContain('dynamic "service_registries"');
      expect(result).toContain('each.key != "kong"');
      expect(result).toContain(
        'aws_service_discovery_service.service[each.key].arn',
      );
    });
  });

  describe('header comment', () => {
    it('should include generation comment', () => {
      const result = generateEcsTf();
      expect(result).toContain('Generated by: npx tsdevstack infra:generate');
    });
  });

  describe('snapshot', () => {
    it('should match snapshot', () => {
      const result = generateEcsTf();
      expect(result).toMatchSnapshot();
    });
  });
});
