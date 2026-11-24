/**
 * Set IAM bindings for Cloud Scheduler to invoke Cloud Run services and jobs
 *
 * Grants the scheduler service account roles/run.invoker on each target
 * service (a trigger's endpoint) and each target job (a cron job's Cloud Run
 * Job, started through the Admin API's run method). Uses @google-cloud/run SDK.
 *
 * This is done outside Terraform so cloud-scheduler.tf has no dependency
 * on existing Cloud Run services and can always be generated.
 */

import { JobsClient, ServicesClient } from '@google-cloud/run';
import type { InfraCoreRuntime } from '../../types/runtime.ts';
import type { GCPCredentials } from '../../types/credentials.ts';
import { buildGCPClientOptions } from '../../utils/gcp/build-gcp-client-options.ts';
import { buildGcpSchedulerAccountEmail } from '../../utils/gcp/build-gcp-scheduler-account-email.ts';

export interface SetSchedulerInvokerBindingsOptions {
  projectId: string;
  projectName: string;
  region: string;
  /** Cloud Run names of the services the triggers call (buildGcpCloudRunName) */
  targetServices: string[];
  /** Cloud Run Job names the cron jobs' schedules start (`{project}-cron-{name}`) */
  targetJobs?: string[];
  credentials: GCPCredentials;
}

/**
 * Set IAM run.invoker bindings for the scheduler service account on target services
 */
export async function setSchedulerInvokerBindings(
  runtime: InfraCoreRuntime,
  options: SetSchedulerInvokerBindingsOptions,
): Promise<void> {
  const clientOptions = buildGCPClientOptions(options.credentials);
  const client = new ServicesClient(clientOptions);
  const schedulerSaEmail = buildGcpSchedulerAccountEmail(
    options.projectName,
    options.projectId,
  );
  const member = `serviceAccount:${schedulerSaEmail}`;
  const role = 'roles/run.invoker';

  const targets: Array<{
    name: string;
    resource: string;
    client: Pick<ServicesClient, 'getIamPolicy' | 'setIamPolicy'>;
  }> = options.targetServices.map((serviceName) => ({
    name: serviceName,
    resource: client.servicePath(
      options.projectId,
      options.region,
      serviceName,
    ),
    client,
  }));
  if (options.targetJobs && options.targetJobs.length > 0) {
    const jobsClient = new JobsClient(clientOptions);
    for (const jobName of options.targetJobs) {
      targets.push({
        name: jobName,
        resource: jobsClient.jobPath(
          options.projectId,
          options.region,
          jobName,
        ),
        client: jobsClient,
      });
    }
  }

  for (const { name: serviceName, resource, client } of targets) {
    try {
      const [currentPolicy] = await client.getIamPolicy({ resource });

      // Check if binding already exists
      const existingBinding = currentPolicy.bindings?.find(
        (b) => b.role === role,
      );
      if (existingBinding?.members?.includes(member)) {
        runtime.logger.success(`  IAM: scheduler can invoke ${serviceName}`);
        continue;
      }

      // Add binding
      const bindings = [...(currentPolicy.bindings ?? [])];
      if (existingBinding) {
        existingBinding.members = [...(existingBinding.members ?? []), member];
      } else {
        bindings.push({ role, members: [member] });
      }

      await client.setIamPolicy({
        resource,
        policy: { ...currentPolicy, bindings },
      });

      runtime.logger.success(`  IAM: scheduler can invoke ${serviceName}`);
    } catch (error) {
      runtime.logger.warn(
        `  Could not set scheduler IAM for ${serviceName}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
