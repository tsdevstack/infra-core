import { describe, it, expect } from '@rstest/core';
import { generateS3StorageTf } from './generate-s3-storage-tf';
import type { AWSInfraConfig } from '../../types/config.ts';

const baseConfig: AWSInfraConfig = {
  provider: 'aws',
  projectName: 'myproject',
  environment: 'dev',
  accountId: '123456789012',
  region: 'us-east-1',
  stateBucket: 'myproject-terraform-state-123456789012',
  lockTable: 'myproject-terraform-locks',
  database: {
    tier: 'db.t3.micro',
    storageSizeGb: 20,
    deletionProtection: false,
    backup: false,
  },
  redis: { tier: 'cache.t3.micro' },
  servicesWithDatabase: [],
  baseDomain: '',
  services: {
    'auth-service': {
      cpu: 256,
      memory: '512',
      minInstances: 1,
      maxInstances: 2,
    },
  },
  workers: {},
  allDeployables: {},
  spas: {},
  frontends: {},
  scheduledJobs: {},
  storageBuckets: ['uploads', 'media'],
};

describe('generateS3StorageTf', () => {
  describe('empty buckets', () => {
    it('should return empty string when no buckets configured', () => {
      const config = { ...baseConfig, storageBuckets: [] };
      expect(generateS3StorageTf(config)).toBe('');
    });
  });

  describe('S3 buckets', () => {
    it('should create S3 bucket resource with for_each', () => {
      const result = generateS3StorageTf(baseConfig);
      expect(result).toContain('resource "aws_s3_bucket" "storage"');
      expect(result).toContain('for_each = local.storage_buckets');
    });

    it('should build correct bucket names in locals', () => {
      const result = generateS3StorageTf(baseConfig);
      expect(result).toContain(
        '"uploads" = "myproject-uploads-dev-123456789012"',
      );
      expect(result).toContain('"media" = "myproject-media-dev-123456789012"');
    });

    it('should set force_destroy to true', () => {
      const result = generateS3StorageTf(baseConfig);
      expect(result).toContain('force_destroy = true');
    });
  });

  describe('public access block', () => {
    it('should block all public access', () => {
      const result = generateS3StorageTf(baseConfig);
      expect(result).toContain(
        'resource "aws_s3_bucket_public_access_block" "storage"',
      );
      expect(result).toContain('block_public_acls       = true');
      expect(result).toContain('block_public_policy     = true');
      expect(result).toContain('ignore_public_acls      = true');
      expect(result).toContain('restrict_public_buckets = true');
    });
  });

  describe('CORS configuration', () => {
    it('should allow all origins', () => {
      const result = generateS3StorageTf(baseConfig);
      expect(result).toContain(
        'resource "aws_s3_bucket_cors_configuration" "storage"',
      );
      expect(result).toContain('allowed_origins = ["*"]');
    });

    it('should allow standard HTTP methods', () => {
      const result = generateS3StorageTf(baseConfig);
      expect(result).toContain(
        'allowed_methods = ["GET", "PUT", "POST", "DELETE", "HEAD"]',
      );
    });
  });

  describe('versioning', () => {
    it('should enable versioning', () => {
      const result = generateS3StorageTf(baseConfig);
      expect(result).toContain('resource "aws_s3_bucket_versioning" "storage"');
      expect(result).toContain('status = "Enabled"');
    });
  });

  describe('lifecycle configuration', () => {
    it('should expire non-current versions after 7 days', () => {
      const result = generateS3StorageTf(baseConfig);
      expect(result).toContain(
        'resource "aws_s3_bucket_lifecycle_configuration" "storage"',
      );
      expect(result).toContain('noncurrent_days = 7');
    });
  });

  describe('IAM policy', () => {
    it('should create S3 access policy on task roles', () => {
      const result = generateS3StorageTf(baseConfig);
      expect(result).toContain(
        'resource "aws_iam_role_policy" "task_s3_storage"',
      );
      expect(result).toContain('for_each = var.services');
    });

    it('should grant required S3 actions', () => {
      const result = generateS3StorageTf(baseConfig);
      expect(result).toContain('"s3:GetObject"');
      expect(result).toContain('"s3:PutObject"');
      expect(result).toContain('"s3:DeleteObject"');
      expect(result).toContain('"s3:ListBucket"');
    });
  });

  describe('output', () => {
    it('should output storage_buckets map', () => {
      const result = generateS3StorageTf(baseConfig);
      expect(result).toContain('output "storage_buckets"');
    });

    it('should include name field in output', () => {
      const result = generateS3StorageTf(baseConfig);
      expect(result).toContain('name   = bucket.id');
    });

    it('should include arn in output', () => {
      const result = generateS3StorageTf(baseConfig);
      expect(result).toContain('arn    = bucket.arn');
    });
  });

  describe('header comment', () => {
    it('should include generation comment', () => {
      const result = generateS3StorageTf(baseConfig);
      expect(result).toContain('Generated by: npx tsdevstack infra:generate');
    });
  });
});
