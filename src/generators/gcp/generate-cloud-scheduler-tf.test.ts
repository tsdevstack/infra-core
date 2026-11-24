import { describe, it, expect } from '@rstest/core';
import { generateCloudSchedulerTf } from './generate-cloud-scheduler-tf';
import type { CronJobConfig, TriggerJobConfig } from '../../types/index.ts';

const LEGACY = { projectName: 'myapp', naming: 'legacy' } as const;

describe('generateCloudSchedulerTf', () => {
  describe('empty jobs', () => {
    it('should return comment when no jobs configured', () => {
      const result = generateCloudSchedulerTf([], LEGACY);
      expect(result).toContain('No scheduled jobs configured');
    });

    it('should include instruction comment', () => {
      const result = generateCloudSchedulerTf([], LEGACY);
      expect(result).toContain('scheduledJobs in infrastructure.json');
    });
  });

  describe('service account', () => {
    const jobs: TriggerJobConfig[] = [
      {
        name: 'cleanup-tokens',
        schedule: '0 */4 * * *',
        targetService: 'auth-service',
        endpoint: '/jobs/cleanup-tokens',
      },
    ];

    it('should create scheduler service account', () => {
      const result = generateCloudSchedulerTf(jobs, LEGACY);
      expect(result).toContain('resource "google_service_account" "scheduler"');
    });

    it('should use project name in account ID', () => {
      const result = generateCloudSchedulerTf(jobs, LEGACY);
      expect(result).toContain(
        'account_id   = "${var.project_name}-scheduler"',
      );
    });
  });

  describe('single job', () => {
    const jobs: TriggerJobConfig[] = [
      {
        name: 'cleanup-tokens',
        schedule: '0 */4 * * *',
        targetService: 'auth-service',
        endpoint: '/jobs/cleanup-tokens',
      },
    ];

    it('should create scheduler job resource', () => {
      const result = generateCloudSchedulerTf(jobs, LEGACY);
      expect(result).toContain(
        'resource "google_cloud_scheduler_job" "cleanup_tokens"',
      );
    });

    it('should use job name', () => {
      const result = generateCloudSchedulerTf(jobs, LEGACY);
      expect(result).toContain('name     = "cleanup-tokens"');
    });

    it('should use schedule', () => {
      const result = generateCloudSchedulerTf(jobs, LEGACY);
      expect(result).toContain('schedule = "0 */4 * * *"');
    });

    it('should use UTC timezone by default', () => {
      const result = generateCloudSchedulerTf(jobs, LEGACY);
      expect(result).toContain('time_zone = "UTC"');
    });

    it('should configure HTTP target with computed service URI', () => {
      const result = generateCloudSchedulerTf(jobs, LEGACY);
      expect(result).toContain('local.scheduler_service_uris.auth_service');
      expect(result).toContain('/jobs/cleanup-tokens');
    });

    it('should use POST method by default', () => {
      const result = generateCloudSchedulerTf(jobs, LEGACY);
      expect(result).toContain('http_method = "POST"');
    });

    it('should configure OIDC token', () => {
      const result = generateCloudSchedulerTf(jobs, LEGACY);
      expect(result).toContain('oidc_token');
      expect(result).toContain(
        'service_account_email = google_service_account.scheduler.email',
      );
    });

    it('should configure retry', () => {
      const result = generateCloudSchedulerTf(jobs, LEGACY);
      expect(result).toContain('retry_config');
      expect(result).toContain('retry_count          = 3');
    });
  });

  describe('job with custom options', () => {
    const jobs: TriggerJobConfig[] = [
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
      const result = generateCloudSchedulerTf(jobs, LEGACY);
      expect(result).toContain('http_method = "GET"');
    });

    it('should use custom timeout', () => {
      const result = generateCloudSchedulerTf(jobs, LEGACY);
      expect(result).toContain('attempt_deadline = "600s"');
    });

    it('should use custom timezone', () => {
      const result = generateCloudSchedulerTf(jobs, LEGACY);
      expect(result).toContain('time_zone = "America/New_York"');
    });
  });

  describe('multiple jobs same service', () => {
    const jobs: TriggerJobConfig[] = [
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
      const result = generateCloudSchedulerTf(jobs, LEGACY);
      expect(result).toContain(
        'resource "google_cloud_scheduler_job" "cleanup_tokens"',
      );
      expect(result).toContain(
        'resource "google_cloud_scheduler_job" "cleanup_sessions"',
      );
    });
  });

  describe('multiple jobs different services', () => {
    const jobs: TriggerJobConfig[] = [
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
      const result = generateCloudSchedulerTf(jobs, LEGACY);
      expect(result).toContain('auth_service = "https://auth-service-');
      expect(result).toContain(
        'notification_service = "https://notification-service-',
      );
    });
  });

  describe('header comment', () => {
    it('should include generation comment', () => {
      const jobs: TriggerJobConfig[] = [
        {
          name: 'cleanup-tokens',
          schedule: '0 */4 * * *',
          targetService: 'auth-service',
          endpoint: '/jobs/cleanup-tokens',
        },
      ];
      const result = generateCloudSchedulerTf(jobs, LEGACY);
      expect(result).toContain('Generated by: npx tsdevstack infra:generate');
    });

    it('should mention SchedulerGuard', () => {
      const jobs: TriggerJobConfig[] = [
        {
          name: 'cleanup-tokens',
          schedule: '0 */4 * * *',
          targetService: 'auth-service',
          endpoint: '/jobs/cleanup-tokens',
        },
      ];
      const result = generateCloudSchedulerTf(jobs, LEGACY);
      expect(result).toContain('SchedulerGuard');
    });
  });

  describe('snapshot', () => {
    it('should match snapshot for single job', () => {
      const jobs: TriggerJobConfig[] = [
        {
          name: 'cleanup-tokens',
          schedule: '0 */4 * * *',
          targetService: 'auth-service',
          endpoint: '/jobs/cleanup-tokens',
        },
      ];
      const result = generateCloudSchedulerTf(jobs, LEGACY);
      expect(result).toMatchSnapshot();
    });

    it('should match snapshot for empty jobs', () => {
      const result = generateCloudSchedulerTf([], LEGACY);
      expect(result).toMatchSnapshot();
    });
  });

  describe('naming scheme', () => {
    const jobs: TriggerJobConfig[] = [
      {
        name: 'cleanup-tokens',
        schedule: '0 */4 * * *',
        targetService: 'auth-service',
        endpoint: '/jobs/cleanup-tokens',
      },
    ];

    it('should keep the bare job and service names in a legacy environment', () => {
      const result = generateCloudSchedulerTf(jobs, LEGACY);
      expect(result).toContain('name     = "cleanup-tokens"');
      expect(result).toContain(
        'auth_service = "https://auth-service-${data.google_project.current.number}',
      );
    });

    it('should put the project in the job name and the target URL in the unique scheme', () => {
      const result = generateCloudSchedulerTf(jobs, {
        projectName: 'myapp',
        naming: 'unique',
      });
      expect(result).toContain('name     = "myapp-cleanup-tokens"');
      expect(result).toContain(
        'auth_service = "https://myapp-auth-service-${data.google_project.current.number}',
      );
      expect(result).toContain(
        'resource "google_cloud_scheduler_job" "cleanup_tokens"',
      );
    });

    it('should name the project in the job description in the unique scheme only', () => {
      expect(
        generateCloudSchedulerTf(jobs, {
          projectName: 'myapp',
          naming: 'unique',
        }),
      ).toContain('  description = "tsdevstack project: myapp"');
      expect(generateCloudSchedulerTf(jobs, LEGACY)).not.toContain(
        'description = "tsdevstack project',
      );
    });
  });
  describe('cron jobs', () => {
    const cronJobs: CronJobConfig[] = [
      {
        name: 'usage-report',
        type: 'cron',
        schedule: '0 3 * * *',
        targetService: 'auth-service',
      },
    ];

    it("should start the job's Cloud Run Job through the Admin API with an OAuth token and no retries", () => {
      const result = generateCloudSchedulerTf([], LEGACY, cronJobs);

      expect(result).toContain(
        'resource "google_cloud_scheduler_job" "usage_report"',
      );
      expect(result).toContain('name     = "usage-report"');
      expect(result).toContain(
        'uri         = "https://run.googleapis.com/v2/projects/${data.google_project.current.project_id}/locations/${var.gcp_region}/jobs/cron-usage-report:run"',
      );
      expect(result).toContain('http_method = "POST"');
      expect(result).toContain('oauth_token {');
      expect(result).not.toContain('oidc_token');
      expect(result).toContain('retry_count = 0');
      expect(result).toContain('time_zone = "UTC"');
      // The scheduler account is there, the service URI locals are not needed
      expect(result).toContain('resource "google_service_account" "scheduler"');
      expect(result).not.toContain('scheduler_service_uris');
    });

    it('should name the Cloud Run Job and the schedule after the project in the unique scheme', () => {
      const result = generateCloudSchedulerTf(
        [],
        { projectName: 'myapp', naming: 'unique' },
        cronJobs,
      );

      expect(result).toContain('name     = "myapp-usage-report"');
      expect(result).toContain('/jobs/myapp-cron-usage-report:run');
      expect(result).toContain('  description = "tsdevstack project: myapp"');
    });

    it('should put both kinds in one file', () => {
      const triggers: TriggerJobConfig[] = [
        {
          name: 'cleanup-tokens',
          schedule: '0 */4 * * *',
          targetService: 'auth-service',
          endpoint: '/jobs/cleanup-tokens',
        },
      ];
      const result = generateCloudSchedulerTf(triggers, LEGACY, cronJobs);

      expect(result).toContain(
        'resource "google_cloud_scheduler_job" "cleanup_tokens"',
      );
      expect(result).toContain(
        'resource "google_cloud_scheduler_job" "usage_report"',
      );
      expect(result).toContain('scheduler_service_uris');
    });

    it("should take the cron job's time zone", () => {
      const result = generateCloudSchedulerTf([], LEGACY, [
        { ...cronJobs[0], timezone: 'Europe/Budapest' },
      ]);
      expect(result).toContain('time_zone = "Europe/Budapest"');
    });
  });
});
