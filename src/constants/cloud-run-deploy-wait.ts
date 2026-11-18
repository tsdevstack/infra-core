/**
 * Waiting for a Cloud Run service deployment
 */

/**
 * gRPC codes of a status check that got no answer: DEADLINE_EXCEEDED (4)
 * and UNAVAILABLE (14). The deployment carries on at Google; the wait reads
 * the service's state instead of failing the deploy.
 */
export const CLOUD_RUN_NO_ANSWER_GRPC_CODES: readonly number[] = [4, 14];

/** Time between two reads of the service's state */
export const CLOUD_RUN_STATUS_POLL_MS = 5_000;

/** How long to read the service's state before giving up */
export const CLOUD_RUN_STATUS_MAX_WAIT_MS = 10 * 60_000;
