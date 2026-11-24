import type { CronJobConfig, ScheduledJobConfig } from '../../types/config.ts';
import { CRON_JOB_TYPE } from '../../constants/scheduled-jobs.ts';

/**
 * Whether a scheduledJobs entry is a cron job (`type: "cron"`): the
 * schedule runs the service's image as `node dist/cron.js <name>`
 */
export function isCronJob(job: ScheduledJobConfig): job is CronJobConfig {
  return job.type === CRON_JOB_TYPE;
}
