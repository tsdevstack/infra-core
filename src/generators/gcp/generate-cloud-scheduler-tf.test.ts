import { describe, it, expect } from '@rstest/core';
import { generateCloudSchedulerTf } from './generate-cloud-scheduler-tf';
import type { ScheduledJobConfig } from '../../types/index.ts';

describe('generateCloudSchedulerTf', () => {
  describe('empty jobs', () => {
    it('should return comment when no jobs configured', () => {
      const result = generateCloudSchedulerTf([]);
      expect(result).toContain('No scheduled jobs configured');
    });

    it('should include instruction comment', () => {
      const result = generateCloudSchedulerTf([]);
      expect(result).toContain('scheduledJobs in infrastructure.json');
    });
  });

  describe('service account', () => {
    const jobs: ScheduledJobConfig[] = [
      {
        name: 'cleanup-tokens',
        schedule: '0 */4 * * *',
        targetService: 'auth-service',
        endpoint: '/jobs/cleanup-tokens',
      },
    ];

    it('should create scheduler service account', () => {
      const result = generateCloudSchedulerTf(jobs);
      expect(result).toContain('resource "google_service_account" "scheduler"');
    });

    it('should use project name in account ID', () => {
      const result = generateCloudSchedulerTf(jobs);
      expect(result).toContain(
        'account_id   = "${var.project_name}-scheduler"',
      );
    });
  });

  describe('single job', () => {
    const jobs: ScheduledJobConfig[] = [
      {
        name: 'cleanup-tokens',
        schedule: '0 */4 * * *',
        targetService: 'auth-service',
        endpoint: '/jobs/cleanup-tokens',
      },
    ];

    it('should create scheduler job resource', () => {
      const result = generateCloudSchedulerTf(jobs);
      expect(result).toContain(
        'resource "google_cloud_scheduler_job" "cleanup_tokens"',
      );
    });

    it('should use job name', () => {
      const result = generateCloudSchedulerTf(jobs);
      expect(result).toContain('name     = "cleanup-tokens"');
    });

    it('should use schedule', () => {
      const result = generateCloudSchedulerTf(jobs);
      expect(result).toContain('schedule = "0 */4 * * *"');
    });

    it('should use UTC timezone by default', () => {
      const result = generateCloudSchedulerTf(jobs);
      expect(result).toContain('time_zone = "UTC"');
    });

    it('should configure HTTP target with computed service URI', () => {
      const result = generateCloudSchedulerTf(jobs);
      expect(result).toContain('local.scheduler_service_uris.auth_service');
      expect(result).toContain('/jobs/cleanup-tokens');
    });

    it('should use POST method by default', () => {
      const result = generateCloudSchedulerTf(jobs);
      expect(result).toContain('http_method = "POST"');
    });

    it('should configure OIDC token', () => {
      const result = generateCloudSchedulerTf(jobs);
      expect(result).toContain('oidc_token');
      expect(result).toContain(
        'service_account_email = google_service_account.scheduler.email',
      );
    });

    it('should configure retry', () => {
      const result = generateCloudSchedulerTf(jobs);
      expect(result).toContain('retry_config');
      expect(result).toContain('retry_count          = 3');
    });
  });

  describe('job with custom options', () => {
    const jobs: ScheduledJobConfig[] = [
      {
        name: 'daily-report',
        schedule: '0 9 * * *',
        targetService: 'reports-service',
        endpoint: '/jobs/generate-report',
        method: 'GET',
        httpTimeout: 600,
        timezone: 'America/New_York',
      },
    ];

    it('should use custom method', () => {
      const result = generateCloudSchedulerTf(jobs);
      expect(result).toContain('http_method = "GET"');
    });

    it('should use custom timeout', () => {
      const result = generateCloudSchedulerTf(jobs);
      expect(result).toContain('attempt_deadline = "600s"');
    });

    it('should use custom timezone', () => {
      const result = generateCloudSchedulerTf(jobs);
      expect(result).toContain('time_zone = "America/New_York"');
    });
  });

  describe('multiple jobs same service', () => {
    const jobs: ScheduledJobConfig[] = [
      {
        name: 'cleanup-tokens',
        schedule: '0 */4 * * *',
        targetService: 'auth-service',
        endpoint: '/jobs/cleanup-tokens',
      },
      {
        name: 'cleanup-sessions',
        schedule: '0 0 * * *',
        targetService: 'auth-service',
        endpoint: '/jobs/cleanup-sessions',
      },
    ];

    it('should create job for each scheduled task', () => {
      const result = generateCloudSchedulerTf(jobs);
      expect(result).toContain(
        'resource "google_cloud_scheduler_job" "cleanup_tokens"',
      );
      expect(result).toContain(
        'resource "google_cloud_scheduler_job" "cleanup_sessions"',
      );
    });
  });

  describe('multiple jobs different services', () => {
    const jobs: ScheduledJobConfig[] = [
      {
        name: 'cleanup-tokens',
        schedule: '0 */4 * * *',
        targetService: 'auth-service',
        endpoint: '/jobs/cleanup-tokens',
      },
      {
        name: 'send-notifications',
        schedule: '*/15 * * * *',
        targetService: 'notification-service',
        endpoint: '/jobs/send-pending',
      },
    ];

    it('should compute URI for each target service', () => {
      const result = generateCloudSchedulerTf(jobs);
      expect(result).toContain('auth_service = "https://auth-service-');
      expect(result).toContain(
        'notification_service = "https://notification-service-',
      );
    });
  });

  describe('header comment', () => {
    it('should include generation comment', () => {
      const jobs: ScheduledJobConfig[] = [
        {
          name: 'cleanup-tokens',
          schedule: '0 */4 * * *',
          targetService: 'auth-service',
          endpoint: '/jobs/cleanup-tokens',
        },
      ];
      const result = generateCloudSchedulerTf(jobs);
      expect(result).toContain('Generated by: npx tsdevstack infra:generate');
    });

    it('should mention SchedulerGuard', () => {
      const jobs: ScheduledJobConfig[] = [
        {
          name: 'cleanup-tokens',
          schedule: '0 */4 * * *',
          targetService: 'auth-service',
          endpoint: '/jobs/cleanup-tokens',
        },
      ];
      const result = generateCloudSchedulerTf(jobs);
      expect(result).toContain('SchedulerGuard');
    });
  });

  describe('snapshot', () => {
    it('should match snapshot for single job', () => {
      const jobs: ScheduledJobConfig[] = [
        {
          name: 'cleanup-tokens',
          schedule: '0 */4 * * *',
          targetService: 'auth-service',
          endpoint: '/jobs/cleanup-tokens',
        },
      ];
      const result = generateCloudSchedulerTf(jobs);
      expect(result).toMatchSnapshot();
    });

    it('should match snapshot for empty jobs', () => {
      const result = generateCloudSchedulerTf([]);
      expect(result).toMatchSnapshot();
    });
  });
});
