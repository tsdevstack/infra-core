/**
 * AWS tracing (X-Ray through its OTLP endpoint)
 */

/**
 * What a task role needs to send spans to X-Ray's OTLP endpoint
 * (AWSXrayWriteOnlyPolicy's trace actions; the OTLP endpoint is reported to
 * check PutTraceSegments, PutSpans covers OpenTelemetry spans)
 */
export const AWS_XRAY_TRACE_WRITE_ACTIONS = [
  'xray:PutTraceSegments',
  'xray:PutSpans',
  'xray:PutSpansForIndexing',
] as const;

/**
 * Log groups Transaction Search writes to: the spans, and Application
 * Signals data
 */
export const AWS_TRANSACTION_SEARCH_LOG_GROUPS = [
  'aws/spans',
  '/aws/application-signals/data',
] as const;
