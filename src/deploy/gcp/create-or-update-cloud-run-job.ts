/**
 * Create or update a Cloud Run Job (no run): the migration jobs and the cron
 * jobs are defined this way, with Direct VPC Egress for the database and
 * Redis, the service's account, and env from Secret Manager and plain values.
 */

import { JobsClient } from '@google-cloud/run';
import type { InfraCoreRuntime } from '../../types/runtime.ts';
import type { GCPCredentials } from '../../types/credentials.ts';
import { InfraCoreError } from '../../runtime/infra-core-error.ts';
import { buildGCPClientOptions } from '../../utils/gcp/build-gcp-client-options.ts';

export interface CloudRunJobDefinitionOptions {
  projectId: string;
  region: string;
  jobName: string;
  imageUri: string;
  command: string[];
  // Direct VPC Egress - job gets IP directly in subnet
  vpcNetwork: string;
  vpcSubnet: string;
  /** Secret set as DATABASE_URL (the migration jobs) */
  secretName?: string;
  /** More environment variables from secrets: name -> secret id */
  secretEnv?: Record<string, string>;
  /** Plain environment variables */
  env?: Record<string, string>;
  serviceAccount: string;
  credentials: GCPCredentials;
  /** CPU allocation (default: '1') */
  cpu?: string;
  /** Memory allocation (default: '2Gi') */
  memory?: string;
  /** Time limit of the job's task, in seconds (default 300) */
  timeoutSeconds?: number;
  /** Labels on the job (the project in the unique scheme, a cron job's service) */
  labels?: Record<string, string>;
}

/**
 * Create the job, or update it to this definition (allowMissing)
 *
 * @returns The job's full resource name
 * @throws InfraCoreError when the API refuses
 */
export async function createOrUpdateCloudRunJob(
  runtime: InfraCoreRuntime,
  options: CloudRunJobDefinitionOptions,
): Promise<string> {
  const jobsClient = new JobsClient(buildGCPClientOptions(options.credentials));
  const parent = `projects/${options.projectId}/locations/${options.region}`;
  const jobName = `${parent}/jobs/${options.jobName}`;

  const jobConfig = {
    name: jobName,
    ...(options.labels ? { labels: options.labels } : {}),
    template: {
      template: {
        serviceAccount: options.serviceAccount,
        containers: [
          {
            image: options.imageUri,
            command: options.command,
            env: [
              ...Object.entries({
                ...(options.secretName
                  ? { DATABASE_URL: options.secretName }
                  : {}),
                ...options.secretEnv,
              }).map(([name, secret]) => ({
                name,
                valueSource: {
                  secretKeyRef: {
                    // Secret name - Cloud Run resolves it within the same project
                    secret,
                    version: 'latest',
                  },
                },
              })),
              ...Object.entries(options.env ?? {}).map(([name, value]) => ({
                name,
                value,
              })),
            ],
            resources: {
              limits: {
                cpu: options.cpu ?? '1',
                memory: options.memory ?? '2Gi',
              },
            },
          },
        ],
        vpcAccess: {
          networkInterfaces: [
            {
              network: options.vpcNetwork,
              subnetwork: options.vpcSubnet,
            },
          ],
          egress: 'PRIVATE_RANGES_ONLY' as const,
        },
        maxRetries: 0,
        timeout: { seconds: options.timeoutSeconds ?? 300 },
      },
    },
  };

  runtime.logger.info(`Creating/updating Cloud Run Job: ${options.jobName}...`);
  try {
    const [updateOperation] = await jobsClient.updateJob({
      job: jobConfig,
      allowMissing: true,
    });
    await updateOperation.promise();
  } catch (error) {
    throw new InfraCoreError(
      `Failed to create/update Cloud Run Job: ${options.jobName}`,
      'cloud-run-jobs',
      error instanceof Error ? error.message : 'Unknown error',
    );
  }
  return jobName;
}
