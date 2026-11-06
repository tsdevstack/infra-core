/**
 * Azure tracing (Azure Monitor's OTLP ingestion through a data collection
 * endpoint and rule; Microsoft's "Ingest OTLP data into Azure Monitor")
 */

/** API version of the data collection rule (azapi) */
export const AZURE_DATA_COLLECTION_RULE_API_VERSION = '2024-03-11';

/**
 * The rule's trace streams: spans, span events and resources. They land in
 * the workspace's OTel tables (OTelSpans and the others)
 */
export const AZURE_OTEL_TRACE_STREAMS = [
  'Microsoft-OTel-Traces-Spans',
  'Microsoft-OTel-Traces-Events',
  'Microsoft-OTel-Traces-Resources',
] as const;

/** Stream in the OTLP traces URL (…/streams/<this>/otlp/v1/traces) */
export const AZURE_OTLP_TRACES_URL_STREAM = 'Microsoft-OTLP-Traces';

/** Role an identity needs on the rule to send spans to it */
export const AZURE_TRACE_PUBLISHER_ROLE = 'Monitoring Metrics Publisher';
