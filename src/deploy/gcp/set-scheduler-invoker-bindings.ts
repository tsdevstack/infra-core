/**
 * Set IAM bindings for Cloud Scheduler to invoke Cloud Run services
 *
 * Grants the scheduler service account roles/run.invoker on each target service.
 * Uses @google-cloud/run SDK (not gcloud CLI).
 *
 * This is done outside Terraform so cloud-scheduler.tf has no dependency
 * on existing Cloud Run services and can always be generated.
 */

import { ServicesClient } from '@google-cloud/run';
import type { InfraCoreRuntime } from '../../types/runtime.ts';
import type { GCPCredentials } from '../../types/credentials.ts';
import { buildGCPClientOptions } from '../../utils/gcp/build-gcp-client-options.ts';

export interface SetSchedulerInvokerBindingsOptions {
  projectId: string;
  projectName: string;
  region: string;
  targetServices: string[];
  credentials: GCPCredentials;
}

/**
 * Set IAM run.invoker bindings for the scheduler service account on target services
 */
export async function setSchedulerInvokerBindings(
  runtime: InfraCoreRuntime,
  options: SetSchedulerInvokerBindingsOptions,
): Promise<void> {
  const client = new ServicesClient(buildGCPClientOptions(options.credentials));
  const schedulerSaEmail = `${options.projectName}-scheduler@${options.projectId}.iam.gserviceaccount.com`;
  const member = `serviceAccount:${schedulerSaEmail}`;
  const role = 'roles/run.invoker';

  for (const serviceName of options.targetServices) {
    const resource = client.servicePath(
      options.projectId,
      options.region,
      serviceName,
    );

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
