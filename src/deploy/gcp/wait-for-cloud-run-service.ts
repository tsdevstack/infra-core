/**
 * Wait for a Cloud Run service deployment to finish
 */

import type { protos } from '@google-cloud/run';
import {
  CLOUD_RUN_NO_ANSWER_GRPC_CODES,
  CLOUD_RUN_STATUS_MAX_WAIT_MS,
  CLOUD_RUN_STATUS_POLL_MS,
} from '../../constants/cloud-run-deploy-wait.ts';

type CloudRunService = protos.google.cloud.run.v2.IService;

export interface WaitForCloudRunServiceOptions {
  /** The operation updateService returned */
  operation: { promise(): Promise<[CloudRunService, ...unknown[]]> };
  /** Reads the service (servicesClient.getService) */
  getService: (name: string) => Promise<CloudRunService>;
  /** Full name: projects/{project}/locations/{region}/services/{name} */
  serviceName: string;
  logger: { info(message: string): void };
  pollIntervalMs?: number;
  maxWaitMs?: number;
}

function isNoAnswer(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  return (
    typeof code === 'number' && CLOUD_RUN_NO_ANSWER_GRPC_CODES.includes(code)
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Waits on the deployment's operation. The operation polls Google, and one
 * poll that gets no answer (a network hiccup) used to fail the deploy while
 * the deployment went on and succeeded. On such an error this reads the
 * service until Google has finished: the new revision ready and serving
 * resolves, a failed one rejects with Google's message. Any other error
 * rejects as before.
 *
 * @returns The deployed service
 */
export async function waitForCloudRunService(
  options: WaitForCloudRunServiceOptions,
): Promise<CloudRunService> {
  try {
    const [service] = await options.operation.promise();
    return service;
  } catch (error) {
    if (!isNoAnswer(error)) {
      throw error;
    }
    options.logger.info(
      `No answer while waiting (${errorMessage(error).split(',')[0]}). Reading the service's state...`,
    );
  }

  const pollIntervalMs = options.pollIntervalMs ?? CLOUD_RUN_STATUS_POLL_MS;
  const deadline =
    Date.now() + (options.maxWaitMs ?? CLOUD_RUN_STATUS_MAX_WAIT_MS);
  let lastError = '';

  for (;;) {
    let service: CloudRunService | undefined;
    try {
      service = await options.getService(options.serviceName);
    } catch (error) {
      if (!isNoAnswer(error)) {
        throw error;
      }
      lastError = errorMessage(error);
    }

    if (service && !service.reconciling) {
      const state = service.terminalCondition?.state;
      const succeeded = state === 'CONDITION_SUCCEEDED' || state === 4;
      if (
        succeeded &&
        service.latestReadyRevision === service.latestCreatedRevision
      ) {
        return service;
      }
      throw new Error(
        service.terminalCondition?.message ||
          `The new revision ${service.latestCreatedRevision ?? ''} is not ready`,
      );
    }

    if (Date.now() >= deadline) {
      throw new Error(
        `The deployment had not finished after ${Math.round((options.maxWaitMs ?? CLOUD_RUN_STATUS_MAX_WAIT_MS) / 60_000)} minutes${lastError ? ` (last error: ${lastError})` : ''}`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }
}
