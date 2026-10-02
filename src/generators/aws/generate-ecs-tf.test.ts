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

    it('should register only Kong with the ALB (backends are VPC-only)', () => {
      const result = generateEcsTf();
      const serviceStart = result.indexOf(
        'resource "aws_ecs_service" "service"',
      );
      const serviceEnd = result.indexOf('resource "', serviceStart + 1);
      const serviceSection = result.substring(serviceStart, serviceEnd);
      expect(serviceSection).toContain('dynamic "load_balancer"');
      expect(serviceSection).toContain(
        'for_each = each.key == "kong" ? [1] : []',
      );
      expect(serviceSection).toContain('container_port   = 8080');
      // No static load_balancer block for every service
      expect(serviceSection).not.toMatch(/^ {2}load_balancer \{/m);
    });

    it('should set the ALB health check grace period only for Kong', () => {
      const result = generateEcsTf();
      expect(result).toContain(
        'health_check_grace_period_seconds = each.key == "kong" ? 120 : null',
      );
    });

    it('should keep the Next.js load balancer integration', () => {
      const result = generateEcsTf();
      const nextjsStart = result.indexOf('resource "aws_ecs_service" "nextjs"');
      const nextjsSection = result.substring(nextjsStart);
      expect(nextjsSection).toContain('load_balancer {');
      expect(nextjsSection).toContain(
        'target_group_arn = aws_lb_target_group.nextjs[each.key].arn',
      );
    });

    it('should run at least one task per service', () => {
      const result = generateEcsTf();
      expect(result).toContain(
        'desired_count   = max(each.value.minInstances, 1)',
      );
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

  describe('service auto scaling (NestJS services and Kong)', () => {
    const section = (result: string, header: string): string => {
      const start = result.indexOf(header);
      const end = result.indexOf('\n}\n', start);
      return result.substring(start, end + 2);
    };

    it('should create a scalable target for every service between min and max', () => {
      const target = section(
        generateEcsTf(),
        'resource "aws_appautoscaling_target" "service"',
      );
      expect(target).toContain('for_each = var.services');
      expect(target).toContain('max_capacity       = each.value.maxInstances');
      expect(target).toContain('min_capacity       = each.value.minInstances');
      expect(target).toContain(
        'resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.service[each.key].name}"',
      );
      expect(target).toContain(
        'scalable_dimension = "ecs:service:DesiredCount"',
      );
    });

    it('should use the same CPU target tracking policy as workers and Next.js', () => {
      const result = generateEcsTf();
      const normalize = (policy: string): string =>
        policy
          .split('\n')
          .filter(
            (line) =>
              !line.includes('resource "') && !line.includes('for_each'),
          )
          .join('\n')
          .replace(/\.(service|worker|nextjs)\[/g, '.X[')
          .replace(
            /aws_appautoscaling_target\.(service|worker|nextjs)\]/g,
            'aws_appautoscaling_target.X]',
          );
      const servicePolicy = section(
        result,
        'resource "aws_appautoscaling_policy" "service_cpu"',
      );
      const workerPolicy = section(
        result,
        'resource "aws_appautoscaling_policy" "worker_cpu"',
      );
      const nextjsPolicy = section(
        result,
        'resource "aws_appautoscaling_policy" "nextjs_cpu"',
      );
      expect(servicePolicy).toContain('for_each = var.services');
      expect(servicePolicy).toContain(
        'predefined_metric_type = "ECSServiceAverageCPUUtilization"',
      );
      expect(servicePolicy).toContain('target_value       = 70.0');
      expect(servicePolicy).toContain('scale_out_cooldown = 60');
      expect(servicePolicy).toContain('scale_in_cooldown  = 300');
      expect(normalize(servicePolicy)).toBe(normalize(workerPolicy));
      expect(normalize(servicePolicy)).toBe(normalize(nextjsPolicy));
    });

    it('should not generate scale-to-zero resources', () => {
      const result = generateEcsTf();
      expect(result).not.toContain('aws_cloudwatch_metric_alarm');
      expect(result).not.toContain('scale_to_zero');
      expect(result).not.toContain('StepScaling');
      expect(result).not.toContain('min_capacity       = 0');
    });
  });

  describe('Kong task environment', () => {
    it('should keep KONG_DNS_RESOLVER for Cloud Map names', () => {
      const result = generateEcsTf();
      expect(result).toContain(
        '{ name = "KONG_DNS_RESOLVER", value = "10.0.0.2" }',
      );
    });

    it('should keep KONG_PROXY_LISTEN on 8080', () => {
      const result = generateEcsTf();
      expect(result).toContain(
        '{ name = "KONG_PROXY_LISTEN", value = "0.0.0.0:8080" }',
      );
    });

    it('should not include wake-up or Lua sandbox settings', () => {
      const result = generateEcsTf();
      expect(result).not.toContain('WAKEUP_LAMBDA_URL');
      expect(result).not.toContain('aws_lambda_function_url.wakeup');
      expect(result).not.toContain('KONG_UNTRUSTED_LUA_SANDBOX');
    });

    it('should use the Kong readiness script with standard health check timings', () => {
      const result = generateEcsTf();
      expect(result).toContain('"/usr/local/bin/kong-health-check.sh"');
      expect(result).toContain('timeout     = 5\n');
      expect(result).toContain('startPeriod = 60\n');
      expect(result).not.toMatch(/timeout\s+= each\.key == "kong"/);
      expect(result).not.toMatch(/startPeriod = each\.key == "kong"/);
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
