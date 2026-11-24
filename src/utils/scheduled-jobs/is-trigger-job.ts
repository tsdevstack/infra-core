import type {
  ScheduledJobConfig,
  TriggerJobConfig,
} from '../../types/config.ts';
import { CRON_JOB_TYPE } from '../../constants/scheduled-jobs.ts';

/**
 * Whether a scheduledJobs entry is a trigger: the schedule calls an endpoint
 * of the service. Today's entries have no `type`; `type: "trigger"` says the
 * same.
 */
export function isTriggerJob(job: ScheduledJobConfig): job is TriggerJobConfig {
  return job.type !== CRON_JOB_TYPE;
}
