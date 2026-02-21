import { describe, it, expect } from '@rstest/core';
import { generateOutputsTf } from './generate-outputs-tf';

describe('generateOutputsTf', () => {
  describe('core outputs', () => {
    it('should output aws_region', () => {
      const result = generateOutputsTf();
      expect(result).toContain('output "aws_region"');
      expect(result).toContain('value       = var.aws_region');
    });

    it('should output aws_account_id', () => {
      const result = generateOutputsTf();
      expect(result).toContain('output "aws_account_id"');
      expect(result).toContain('value       = var.aws_account_id');
    });

    it('should output project_name', () => {
      const result = generateOutputsTf();
      expect(result).toContain('output "project_name"');
      expect(result).toContain('value       = var.project_name');
    });

    it('should output environment', () => {
      const result = generateOutputsTf();
      expect(result).toContain('output "environment"');
      expect(result).toContain('value       = var.environment');
    });
  });

  describe('ECR outputs', () => {
    it('should output ecr_repository_url', () => {
      const result = generateOutputsTf();
      expect(result).toContain('output "ecr_repository_url"');
      expect(result).toContain(
        '${var.aws_account_id}.dkr.ecr.${var.aws_region}.amazonaws.com/${var.project_name}',
      );
    });
  });

  describe('ECS outputs', () => {
    it('should output ecs_cluster_name', () => {
      const result = generateOutputsTf();
      expect(result).toContain('output "ecs_cluster_name"');
      expect(result).toContain('aws_ecs_cluster.main.name');
    });

    it('should output ecs_execution_role_arn', () => {
      const result = generateOutputsTf();
      expect(result).toContain('output "ecs_execution_role_arn"');
      expect(result).toContain('aws_iam_role.ecs_execution.arn');
    });

    it('should output ecs_task_role_arns', () => {
      const result = generateOutputsTf();
      expect(result).toContain('output "ecs_task_role_arns"');
    });
  });

  describe('Redis outputs', () => {
    it('should output redis_host', () => {
      const result = generateOutputsTf();
      expect(result).toContain('output "redis_host"');
      expect(result).toContain(
        'aws_elasticache_replication_group.main.primary_endpoint_address',
      );
    });

    it('should output redis_port', () => {
      const result = generateOutputsTf();
      expect(result).toContain('output "redis_port"');
    });

    it('should output redis_auth_token as sensitive', () => {
      const result = generateOutputsTf();
      expect(result).toContain('output "redis_auth_token"');
      expect(result).toContain('sensitive   = true');
    });
  });

  describe('database outputs', () => {
    it('should output database_host', () => {
      const result = generateOutputsTf();
      expect(result).toContain('output "database_host"');
      expect(result).toContain('aws_db_instance.main.address');
    });

    it('should output database_port', () => {
      const result = generateOutputsTf();
      expect(result).toContain('output "database_port"');
      expect(result).toContain('aws_db_instance.main.port');
    });
  });

  describe('db-init outputs', () => {
    it('should output db_init_task_arn', () => {
      const result = generateOutputsTf();
      expect(result).toContain('output "db_init_task_arn"');
      expect(result).toContain('aws_ecs_task_definition.db_init.arn');
    });

    it('should output db_init_ecr_url', () => {
      const result = generateOutputsTf();
      expect(result).toContain('output "db_init_ecr_url"');
      expect(result).toContain('aws_ecr_repository.db_init.repository_url');
    });
  });

  describe('db-delete outputs', () => {
    it('should output db_delete_ecr_url', () => {
      const result = generateOutputsTf();
      expect(result).toContain('output "db_delete_ecr_url"');
      expect(result).toContain('aws_ecr_repository.db_delete.repository_url');
    });
  });

  describe('network outputs', () => {
    it('should output vpc_id', () => {
      const result = generateOutputsTf();
      expect(result).toContain('output "vpc_id"');
      expect(result).toContain('aws_vpc.main.id');
    });

    it('should output private_subnet_ids as JSON', () => {
      const result = generateOutputsTf();
      expect(result).toContain('output "private_subnet_ids"');
      expect(result).toContain('jsonencode(aws_subnet.private[*].id)');
    });

    it('should output ecs_security_group_id', () => {
      const result = generateOutputsTf();
      expect(result).toContain('output "ecs_security_group_id"');
      expect(result).toContain('aws_security_group.ecs.id');
    });
  });

  describe('API and Kong outputs', () => {
    it('should output api_url', () => {
      const result = generateOutputsTf();
      expect(result).toContain('output "api_url"');
    });

    it('should output alb_internal_dns for Kong routing', () => {
      const result = generateOutputsTf();
      expect(result).toContain('output "alb_internal_dns"');
      expect(result).toContain('aws_lb.main.dns_name');
    });

    it('should output wakeup_lambda_url', () => {
      const result = generateOutputsTf();
      expect(result).toContain('output "wakeup_lambda_url"');
      expect(result).toContain('aws_lambda_function_url.wakeup.function_url');
    });

    it('should output wakeup_secret as sensitive', () => {
      const result = generateOutputsTf();
      expect(result).toContain('output "wakeup_secret"');
      expect(result).toContain('random_password.wakeup_secret.result');
      // Check it's marked as sensitive (after the wakeup_secret output)
      const secretOutputStart = result.indexOf('output "wakeup_secret"');
      const secretOutputSection = result.substring(
        secretOutputStart,
        result.indexOf('}', secretOutputStart) + 1,
      );
      expect(secretOutputSection).toContain('sensitive   = true');
    });

    it('should output cloudmap_namespace for service discovery', () => {
      const result = generateOutputsTf();
      expect(result).toContain('output "cloudmap_namespace"');
      expect(result).toContain(
        'aws_service_discovery_private_dns_namespace.main.name',
      );
    });
  });

  describe('SPA services outputs', () => {
    it('should not include SPA outputs when no SPA services', () => {
      const result = generateOutputsTf();
      expect(result).not.toContain('_spa_bucket"');
      expect(result).not.toContain('_cloudfront_id"');
    });

    it('should include SPA bucket output for each SPA service', () => {
      const result = generateOutputsTf({
        spaServices: [{ name: 'frontend' }],
      });
      expect(result).toContain('output "frontend_spa_bucket"');
      expect(result).toContain('aws_s3_bucket.spa["frontend"].id');
    });

    it('should include CloudFront ID output for each SPA service', () => {
      const result = generateOutputsTf({
        spaServices: [{ name: 'frontend' }],
      });
      expect(result).toContain('output "frontend_cloudfront_id"');
      expect(result).toContain(
        'aws_cloudfront_distribution.spa["frontend"].id',
      );
    });

    it('should handle multiple SPA services', () => {
      const result = generateOutputsTf({
        spaServices: [{ name: 'frontend' }, { name: 'admin-portal' }],
      });
      expect(result).toContain('output "frontend_spa_bucket"');
      expect(result).toContain('output "admin_portal_spa_bucket"');
      expect(result).toContain('output "frontend_cloudfront_id"');
      expect(result).toContain('output "admin_portal_cloudfront_id"');
    });

    it('should convert service names to terraform IDs', () => {
      const result = generateOutputsTf({
        spaServices: [{ name: 'my-spa-app' }],
      });
      // toTerraformId converts kebab-case to snake_case
      expect(result).toContain('output "my_spa_app_spa_bucket"');
    });
  });

  describe('header comment', () => {
    it('should include generation comment', () => {
      const result = generateOutputsTf();
      expect(result).toContain('Generated by: npx tsdevstack infra:generate');
    });
  });

  describe('snapshot', () => {
    it('should match snapshot without SPA services', () => {
      const result = generateOutputsTf();
      expect(result).toMatchSnapshot();
    });

    it('should match snapshot with SPA services', () => {
      const result = generateOutputsTf({
        spaServices: [{ name: 'frontend' }, { name: 'admin-portal' }],
      });
      expect(result).toMatchSnapshot();
    });
  });
});
