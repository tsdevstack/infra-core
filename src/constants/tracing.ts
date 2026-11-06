/**
 * Tracing settings of deployed services, workers, frontends and Kong
 */

/**
 * Share of new traces kept when infrastructure.json sets no
 * tracing.sampleRate for the environment (TRACE_SAMPLE_RATE)
 */
export const DEFAULT_TRACE_SAMPLE_RATE = 1;
