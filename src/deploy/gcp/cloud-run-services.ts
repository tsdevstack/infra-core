/**
 * Cloud Run Services utility for deploying services
 *
 * Uses @google-cloud/run ServicesClient to deploy services
 * with Direct VPC Egress for database access and service-to-service calls.
 *
 * Network architecture:
 * - Direct VPC Egress: Service instances get IPs directly in VPC subnet
 * - PRIVATE_RANGES_ONLY egress: Private IPs → VPC, public IPs → internet
 * - Cloud DNS routes *.run.app to private IPs (199.36.153.x)
 * - Result: Service-to-service calls stay internal, external APIs work
 */

import { ServicesClient } from '@google-cloud/run';
import type { InfraCoreRuntime } from '../../types/runtime.ts';
import type { GCPCredentials } from '../../types/credentials.ts';
import { InfraCoreError } from '../../runtime/infra-core-error.ts';
import { buildGCPClientOptions } from '../../utils/gcp/build-gcp-client-options.ts';
import { setServiceInvokerPolicy } from './set-service-invoker-policy.ts';

export interface CloudRunServiceOptions {
  projectId: string;
  region: string;
  serviceName: string;
  imageUri: string;
  // Direct VPC Egress - service gets IP directly in subnet
  // Required for: database access, service-to-service calls, external APIs
  vpcNetwork?: string; // e.g., "projects/xxx/global/networks/tsdevstack-vpc"
  vpcSubnet?: string; // e.g., "projects/xxx/regions/us-central1/subnetworks/tsdevstack-subnet"
  serviceAccount: string;
  credentials: GCPCredentials;
  minInstances: number;
  maxInstances: number;
  cpu: string;
  memory: string;
  timeout: string;
  concurrency: number;
  envVars: Record<string, string>;
  secrets: Array<{ envVar: string; secretName: string; version: string }>;
  ingress:
    | 'INGRESS_TRAFFIC_ALL'
    | 'INGRESS_TRAFFIC_INTERNAL_ONLY'
    | 'INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER';
  // Optional container command override (default: use image entrypoint)
  // Used by workers to run `["node", "dist/worker.js"]` instead of main app
  command?: string[];
  // CPU idle setting (default: true for regular services)
  // Workers set this to false to keep CPU always allocated for queue processing
  cpuIdle?: boolean;
}

export interface CloudRunServiceResult {
  success: boolean;
  serviceUrl?: string;
  error?: string;
}

/**
 * Deploy a service to Cloud Run
 */
export async function deployCloudRunService(
  runtime: InfraCoreRuntime,
  options: CloudRunServiceOptions,
): Promise<CloudRunServiceResult> {
  const servicesClient = new ServicesClient(
    buildGCPClientOptions(options.credentials),
  );

  const parent = `projects/${options.projectId}/locations/${options.region}`;
  const serviceName = `${parent}/services/${options.serviceName}`;

  // Parse timeout (e.g., "300s" -> 300)
  const timeoutSeconds = parseInt(options.timeout.replace('s', ''), 10);

  // Build environment variables
  const envVars = Object.entries(options.envVars).map(([name, value]) => ({
    name,
    value,
  }));

  // Build secrets
  const secretEnvVars = options.secrets.map((secret) => ({
    name: secret.envVar,
    valueSource: {
      secretKeyRef: {
        secret: secret.secretName,
        version: secret.version,
      },
    },
  }));

  // Build container config
  const containerConfig: Record<string, unknown> = {
    image: options.imageUri,
    ports: [{ containerPort: 8080 }],
    env: [...envVars, ...secretEnvVars],
    resources: {
      limits: {
        cpu: options.cpu,
        memory: options.memory,
      },
      // CPU allocation mode:
      // - true (default): CPU only allocated during request processing (cheaper)
      // - false: CPU always allocated even when idle (required for workers)
      cpuIdle: options.cpuIdle ?? true,
    },
    startupProbe: {
      httpGet: {
        path: '/health',
        port: 8080,
      },
      initialDelaySeconds: 0,
      timeoutSeconds: 3,
      periodSeconds: 10,
      failureThreshold: 3,
    },
  };

  // Add custom command if specified (used by workers)
  if (options.command && options.command.length > 0) {
    containerConfig.command = options.command;
  }

  // Build template config
  const templateConfig: Record<string, unknown> = {
    serviceAccount: options.serviceAccount,
    scaling: {
      minInstanceCount: options.minInstances,
      maxInstanceCount: options.maxInstances,
    },
    containers: [containerConfig],
    timeout: { seconds: timeoutSeconds },
    maxInstanceRequestConcurrency: options.concurrency,
    startupCpuBoost: true,
  };

  // Direct VPC Egress - service instances get IPs directly in the VPC subnet
  // PRIVATE_RANGES_ONLY: Private IPs (10.x, 172.16-31.x, 192.168.x, 199.36.153.x) → VPC
  //                      Public IPs → Internet directly
  // Cloud DNS routes *.run.app to 199.36.153.x (private range) enabling:
  // - Service-to-service calls stay internal (VPC-only ingress works)
  // - External APIs (Resend, Stripe) go to internet (no Cloud NAT needed)
  if (options.vpcNetwork && options.vpcSubnet) {
    templateConfig.vpcAccess = {
      networkInterfaces: [
        {
          network: options.vpcNetwork,
          subnetwork: options.vpcSubnet,
        },
      ],
      egress: 'PRIVATE_RANGES_ONLY',
    };
  }

  // Service configuration
  const serviceConfig = {
    name: serviceName,
    ingress: options.ingress,
    template: templateConfig,
  };

  // Create or update service using allowMissing flag
  runtime.logger.info(`Deploying Cloud Run Service: ${options.serviceName}...`);
  try {
    const [operation] = await servicesClient.updateService({
      service: serviceConfig,
      allowMissing: true,
    });

    runtime.logger.info('Waiting for deployment to complete...');
    const [service] = await operation.promise();

    const serviceUrl = service.uri;

    // For non-public services, add allUsers as invoker
    // This is safe because ingress restricts access:
    // - INTERNAL_ONLY: Only VPC traffic (Kong invokes backend services)
    // - INTERNAL_LOAD_BALANCER: Only VPC + load balancer traffic (LB invokes frontend)
    if (options.ingress !== 'INGRESS_TRAFFIC_ALL') {
      await setServiceInvokerPolicy(runtime, options);
    }

    return {
      success: true,
      serviceUrl: serviceUrl ?? undefined,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    throw new InfraCoreError(
      `Failed to deploy Cloud Run Service: ${options.serviceName}`,
      'cloud-run-services',
      errorMessage,
    );
  }
}
