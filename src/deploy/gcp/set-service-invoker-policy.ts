/**
 * Set IAM policy to allow allUsers to invoke a Cloud Run service
 *
 * Used for internal-only services where ingress restricts access to VPC.
 * Uses @google-cloud/run SDK (not gcloud CLI).
 */

import { ServicesClient } from '@google-cloud/run';
import type { InfraCoreRuntime } from '../../types/runtime.ts';
import type { GCPCredentials } from '../../types/credentials.ts';
import { buildGCPClientOptions } from '../../utils/gcp/build-gcp-client-options.ts';

export interface SetServiceInvokerPolicyOptions {
  projectId: string;
  region: string;
  serviceName: string;
  credentials: GCPCredentials;
}

/**
 * Set IAM policy to allow allUsers to invoke the service
 */
export async function setServiceInvokerPolicy(
  runtime: InfraCoreRuntime,
  options: SetServiceInvokerPolicyOptions,
): Promise<void> {
  const client = new ServicesClient(buildGCPClientOptions(options.credentials));
  const resource = client.servicePath(
    options.projectId,
    options.region,
    options.serviceName,
  );

  try {
    // Get current policy
    const [currentPolicy] = await client.getIamPolicy({ resource });

    const member = 'allUsers';
    const role = 'roles/run.invoker';

    // Check if binding already exists
    const existingBinding = currentPolicy.bindings?.find(
      (b) => b.role === role,
    );
    if (existingBinding?.members?.includes(member)) {
      runtime.logger.success('  IAM: allUsers can invoke (VPC-only ingress)');
      return;
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

    runtime.logger.success('  IAM: allUsers can invoke (VPC-only ingress)');
  } catch (error) {
    runtime.logger.warn(
      `  Could not set IAM invoker policy: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
