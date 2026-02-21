import { describe, it, expect } from '@rstest/core';
import { generateEventbridgeTf } from './generate-eventbridge-tf';

describe('generateEventbridgeTf', () => {
  describe('job auth secret', () => {
    it('should create random password', () => {
      const result = generateEventbridgeTf();
      expect(result).toContain('resource "random_password" "job_auth"');
    });

    it('should use 64 character password', () => {
      const result = generateEventbridgeTf();
      expect(result).toContain('length  = 64');
    });

    it('should create Secrets Manager secret', () => {
      const result = generateEventbridgeTf();
      expect(result).toContain(
        'resource "aws_secretsmanager_secret" "job_auth"',
      );
    });

    it('should create secret version', () => {
      const result = generateEventbridgeTf();
      expect(result).toContain(
        'resource "aws_secretsmanager_secret_version" "job_auth"',
      );
    });
  });

  describe('job invoker Lambda', () => {
    it('should create Lambda function', () => {
      const result = generateEventbridgeTf();
      expect(result).toContain('resource "aws_lambda_function" "job_invoker"');
    });

    it('should use Node.js 22 runtime', () => {
      const result = generateEventbridgeTf();
      expect(result).toContain('runtime       = "nodejs22.x"');
    });

    it('should have 5 minute timeout', () => {
      const result = generateEventbridgeTf();
      expect(result).toContain('timeout       = 300');
    });

    it('should be in VPC for CloudMap DNS', () => {
      const result = generateEventbridgeTf();
      expect(result).toContain('vpc_config {');
      expect(result).toContain('subnet_ids         = aws_subnet.private[*].id');
    });

    it('should pass environment variables', () => {
      const result = generateEventbridgeTf();
      expect(result).toContain(
        'ECS_CLUSTER        = aws_ecs_cluster.main.name',
      );
      expect(result).toContain(
        'SERVICE_NAMES      = join(",", keys(var.services))',
      );
      expect(result).toContain(
        'CLOUDMAP_NAMESPACE = "${var.project_name}.local"',
      );
      expect(result).toContain(
        'JOB_SECRET_ARN     = aws_secretsmanager_secret.job_auth.arn',
      );
    });
  });

  describe('job invoker Lambda IAM', () => {
    it('should create IAM role', () => {
      const result = generateEventbridgeTf();
      expect(result).toContain('resource "aws_iam_role" "job_invoker_lambda"');
    });

    it('should allow Lambda to assume role', () => {
      const result = generateEventbridgeTf();
      expect(result).toContain('Service = "lambda.amazonaws.com"');
    });

    it('should allow ECS permissions', () => {
      const result = generateEventbridgeTf();
      expect(result).toContain('"ecs:UpdateService"');
      expect(result).toContain('"ecs:DescribeServices"');
    });

    it('should allow Secrets Manager access', () => {
      const result = generateEventbridgeTf();
      expect(result).toContain('"secretsmanager:GetSecretValue"');
    });

    it('should allow VPC network interface management', () => {
      const result = generateEventbridgeTf();
      expect(result).toContain('"ec2:CreateNetworkInterface"');
      expect(result).toContain('"ec2:DescribeNetworkInterfaces"');
      expect(result).toContain('"ec2:DeleteNetworkInterface"');
    });
  });

  describe('EventBridge scheduler IAM', () => {
    it('should create IAM role for scheduler', () => {
      const result = generateEventbridgeTf();
      expect(result).toContain(
        'resource "aws_iam_role" "eventbridge_scheduler"',
      );
    });

    it('should allow scheduler to assume role', () => {
      const result = generateEventbridgeTf();
      expect(result).toContain('Service = "scheduler.amazonaws.com"');
    });

    it('should allow Lambda invocation', () => {
      const result = generateEventbridgeTf();
      expect(result).toContain('"lambda:InvokeFunction"');
    });
  });

  describe('EventBridge schedules', () => {
    it('should create schedule per job', () => {
      const result = generateEventbridgeTf();
      expect(result).toContain('resource "aws_scheduler_schedule" "job"');
      expect(result).toContain('for_each = var.scheduled_jobs');
    });

    it('should use schedule expression from config', () => {
      const result = generateEventbridgeTf();
      expect(result).toContain('schedule_expression = each.value.schedule');
    });

    it('should disable flexible time window', () => {
      const result = generateEventbridgeTf();
      expect(result).toContain('mode = "OFF"');
    });

    it('should target job invoker Lambda', () => {
      const result = generateEventbridgeTf();
      expect(result).toContain(
        'arn      = aws_lambda_function.job_invoker.arn',
      );
    });

    it('should pass serviceName and path as input', () => {
      const result = generateEventbridgeTf();
      expect(result).toContain('serviceName = each.value.serviceName');
      expect(result).toContain('path        = each.value.path');
    });

    it('should configure retry policy', () => {
      const result = generateEventbridgeTf();
      expect(result).toContain('retry_policy {');
      expect(result).toContain('maximum_retry_attempts       = 3');
    });
  });

  describe('header comment', () => {
    it('should include generation comment', () => {
      const result = generateEventbridgeTf();
      expect(result).toContain('Generated by: npx tsdevstack infra:generate');
    });
  });

  describe('snapshot', () => {
    it('should match snapshot', () => {
      const result = generateEventbridgeTf();
      expect(result).toMatchSnapshot();
    });
  });
});
