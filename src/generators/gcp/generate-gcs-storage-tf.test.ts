import { describe, it, expect } from '@rstest/core';
import { generateGcsStorageTf } from './generate-gcs-storage-tf';
import type { GCPInfraConfig } from '../../types/config.ts';

const baseConfig: GCPInfraConfig = {
  provider: 'gcp',
  projectName: 'myproject',
  environment: 'dev',
  gcpProjectId: 'myproject-dev-123456',
  region: 'us-central1',
  stateBucket: 'myproject-tf-state-myproject-dev-123456',
  naming: 'legacy',
  database: {
    tier: 'db-f1-micro',
    storageSizeGb: 10,
    deletionProtection: false,
    backup: false,
  },
  redis: { tier: 'BASIC', memoryGb: 1 },
  servicesWithDatabase: [],
  baseDomain: '',
  services: {},
  workers: {},
  allDeployables: {},
  spas: {},
  frontends: {},
  scheduledJobs: {},
  storageBuckets: ['uploads', 'media'],
};

describe('generateGcsStorageTf', () => {
  describe('empty buckets', () => {
    it('should return empty string when no buckets configured', () => {
      const config = { ...baseConfig, storageBuckets: [] };
      expect(generateGcsStorageTf(config)).toBe('');
    });
  });

  describe('GCS buckets', () => {
    it('should create GCS bucket resource with for_each', () => {
      const result = generateGcsStorageTf(baseConfig);
      expect(result).toContain('resource "google_storage_bucket" "storage"');
      expect(result).toContain('for_each = local.storage_buckets');
    });

    it('should build correct bucket names in locals', () => {
      const result = generateGcsStorageTf(baseConfig);
      expect(result).toContain('"uploads" = "myproject-uploads-dev"');
      expect(result).toContain('"media" = "myproject-media-dev"');
    });

    it("should add the GCP project's suffix in the unique scheme", () => {
      const result = generateGcsStorageTf({ ...baseConfig, naming: 'unique' });
      expect(result).toContain('"uploads" = "myproject-uploads-dev-907669"');
      expect(result).toContain('"media" = "myproject-media-dev-907669"');
    });

    it('should set force_destroy to true', () => {
      const result = generateGcsStorageTf(baseConfig);
      expect(result).toContain('force_destroy = true');
    });

    it('should enable uniform bucket-level access', () => {
      const result = generateGcsStorageTf(baseConfig);
      expect(result).toContain('uniform_bucket_level_access = true');
    });

    it('should enforce public access prevention', () => {
      const result = generateGcsStorageTf(baseConfig);
      expect(result).toContain('public_access_prevention    = "enforced"');
    });

    it('should use gcp_region variable for location', () => {
      const result = generateGcsStorageTf(baseConfig);
      expect(result).toContain('location      = var.gcp_region');
    });
  });

  describe('CORS configuration', () => {
    it('should allow all origins', () => {
      const result = generateGcsStorageTf(baseConfig);
      expect(result).toContain('origin          = ["*"]');
    });

    it('should allow standard HTTP methods', () => {
      const result = generateGcsStorageTf(baseConfig);
      expect(result).toContain(
        'method          = ["GET", "PUT", "POST", "DELETE", "HEAD"]',
      );
    });
  });

  describe('soft delete policy', () => {
    it('should set 7-day retention', () => {
      const result = generateGcsStorageTf(baseConfig);
      expect(result).toContain('soft_delete_policy {');
      expect(result).toContain('retention_duration_seconds = 604800');
    });
  });

  describe('IAM bindings', () => {
    it('should grant storage.objectUser to runtime service accounts', () => {
      const result = generateGcsStorageTf(baseConfig);
      expect(result).toContain(
        'resource "google_storage_bucket_iam_member" "storage_object_user"',
      );
      expect(result).toContain('role   = "roles/storage.objectUser"');
    });

    it('should use setproduct of buckets and services for objectUser binding', () => {
      const result = generateGcsStorageTf(baseConfig);
      expect(result).toContain(
        'setproduct(keys(local.storage_buckets), local.services)',
      );
    });

    it('should grant serviceAccountTokenCreator for presigned URLs', () => {
      const result = generateGcsStorageTf(baseConfig);
      expect(result).toContain(
        'resource "google_service_account_iam_member" "storage_token_creator"',
      );
      expect(result).toContain(
        'role               = "roles/iam.serviceAccountTokenCreator"',
      );
    });

    it('should grant token creator on each service account, not the project', () => {
      const result = generateGcsStorageTf(baseConfig);
      expect(result).toContain(
        'service_account_id = google_service_account.runtime[each.key].name',
      );
      expect(result).toContain(
        'member             = "serviceAccount:${google_service_account.runtime[each.key].email}"',
      );
      expect(result).not.toContain('google_project_iam_member');
    });

    it('should enable the Service Account Credentials API and keep it on destroy', () => {
      const result = generateGcsStorageTf(baseConfig);
      expect(result).toContain(
        'resource "google_project_service" "iamcredentials"',
      );
      expect(result).toContain(
        'service            = "iamcredentials.googleapis.com"',
      );
      expect(result).toContain('disable_on_destroy = false');
    });

    it('should iterate over local.services for token creator role', () => {
      const result = generateGcsStorageTf(baseConfig);
      expect(result).toContain('for_each = toset(local.services)');
    });
  });

  describe('output', () => {
    it('should output storage_buckets map', () => {
      const result = generateGcsStorageTf(baseConfig);
      expect(result).toContain('output "storage_buckets"');
    });

    it('should include name field in output', () => {
      const result = generateGcsStorageTf(baseConfig);
      expect(result).toContain('name     = bucket.name');
    });

    it('should include location in output', () => {
      const result = generateGcsStorageTf(baseConfig);
      expect(result).toContain('location = bucket.location');
    });
  });

  describe('header comment', () => {
    it('should include generation comment', () => {
      const result = generateGcsStorageTf(baseConfig);
      expect(result).toContain('Generated by: npx tsdevstack infra:generate');
    });
  });

  describe('access logs', () => {
    it("should turn on Cloud Storage's Data Access audit logs, reads and writes", () => {
      const result = generateGcsStorageTf(baseConfig);
      const audit = result.slice(
        result.indexOf('resource "google_project_iam_audit_config" "storage"'),
        result.indexOf('resource "google_logging_project_exclusion"'),
      );
      expect(audit).toContain('service = "storage.googleapis.com"');
      expect(audit).toContain('log_type = "DATA_READ"');
      expect(audit).toContain('log_type = "DATA_WRITE"');
      expect(audit).not.toContain('ADMIN_READ');
    });

    it('should drop the access logs of every bucket but the storage buckets', () => {
      const result = generateGcsStorageTf(baseConfig);
      expect(result).toContain(
        'filter      = "logName=\\"projects/${var.gcp_project_id}/logs/cloudaudit.googleapis.com%2Fdata_access\\" AND resource.type=\\"gcs_bucket\\" AND NOT (resource.labels.bucket_name=\\"myproject-uploads-dev\\" OR resource.labels.bucket_name=\\"myproject-media-dev\\")"',
      );
    });

    it('should keep the storage buckets by their unique names', () => {
      const result = generateGcsStorageTf({ ...baseConfig, naming: 'unique' });
      const filter = result.slice(result.indexOf('filter      ='));
      expect(filter).toMatch(
        /bucket_name=\\"myproject-uploads-dev-[0-9a-f]{6}\\"/,
      );
    });

    it('should turn on no access logs without buckets', () => {
      expect(generateGcsStorageTf({ ...baseConfig, storageBuckets: [] })).toBe(
        '',
      );
    });
  });
});
