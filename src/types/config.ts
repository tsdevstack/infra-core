/**
 * Consolidated Infrastructure Configuration Types
 *
 * Unified type system for Terraform generation across all providers.
 * Consolidates Azure, AWS, and GCP generate config types into a single
 * discriminated union (InfraConfig) with shared sub-types.
 *
 * Provider-specific fields that only apply to one provider are optional
 * on the shared sub-types. Provider-specific top-level fields live on
 * the provider extension interfaces.
 */

// ---------------------------------------------------------------------------
// Sub-types — shared across all providers
// ---------------------------------------------------------------------------

/**
 * Database configuration for Terraform generation
 *
 * Unified from:
 * - Azure: { tier, storageSizeGb, deletionProtection, backup }
 * - AWS:   { tier, storageSizeGb, deletionProtection, backup }
 * - GCP:   { tier, diskSize, ha, backup }
 */
export interface DatabaseConfig {
  tier: string;
  /** Storage size in GB (GCP equivalent: diskSize) */
  storageSizeGb: number;
  deletionProtection: boolean;
  backup: boolean;
  /** High availability — GCP only */
  ha?: boolean;
}

/**
 * Redis configuration for Terraform generation
 *
 * Unified from:
 * - Azure: { tier }
 * - AWS:   { tier, highAvailability }
 * - GCP:   { tier, memoryGb }
 */
export interface RedisConfig {
  tier: string;
  /** Memory size in GB — GCP only */
  memoryGb?: number;
  /** Enable high availability — AWS only */
  highAvailability?: boolean;
}

/**
 * Service info for database creation
 */
export interface ServiceDatabaseInfo {
  name: string;
  hasDatabase: boolean;
}

/**
 * Backend service configuration (Container Apps / ECS / Cloud Run)
 *
 * Unified from:
 * - Azure: { cpu: number, memory: string, minInstances, maxInstances }
 * - AWS:   { cpu: number, memory: number, minInstances, maxInstances, dbPoolMax }
 * - GCP:   (passed as separate args — unified in 25b)
 *
 * Memory is normalized to string (e.g., "2Gi", "1024Mi").
 * Generators parse provider-specific formats.
 */
export interface ServiceConfig {
  cpu: number;
  memory: string;
  minInstances: number;
  maxInstances: number;
  /** Database connection pool max — AWS only */
  dbPoolMax?: number;
}

/**
 * Frontend service configuration (App Service / App Runner / Cloud Run)
 *
 * For Next.js and other SSR frontends deployed as containers.
 */
export interface FrontendConfig {
  domain: string;
  cpu: number;
  memory: string;
  minInstances: number;
  maxInstances: number;
}

/**
 * SPA service configuration (Azure Blob / S3 / Cloud Storage + CDN)
 */
export interface SPAConfig {
  domain: string;
}

/**
 * Worker configuration (Container Apps / ECS / Cloud Run)
 */
export interface WorkerConfig {
  cpu: number;
  memory: string;
  /** The parent service this worker belongs to */
  service: string;
  /** Database connection pool max — AWS only */
  dbPoolMax?: number;
}

/**
 * Scheduled job configuration (Container App Jobs / EventBridge / Cloud Scheduler)
 */
export interface ScheduledJobConfig {
  /** Job name (e.g., "cleanup-tokens") */
  name: string;
  /** Cron schedule (e.g., "0 0 * * *" for daily) */
  schedule: string;
  /** Target service name (e.g., "auth-service") */
  targetService: string;
  /** Endpoint path (e.g., "/jobs/cleanup-tokens") */
  endpoint: string;
  /** HTTP method (default: POST) */
  method?: string;
  /** HTTP timeout in seconds (default: 300) */
  httpTimeout?: number;
  /** Timezone (default: UTC) */
  timezone?: string;
}

/**
 * Frontend hosting type
 * - "cloudrun": SSR apps (Next.js) on Cloud Run (default)
 * - "spa": Static SPAs on Cloud Storage + CDN
 */
export type FrontendHostingType = 'cloudrun' | 'spa';

// ---------------------------------------------------------------------------
// WAF types — provider-specific rule formats
// ---------------------------------------------------------------------------

/**
 * Rate limit configuration for GCP Cloud Armor custom rules
 */
export interface WafRateLimitConfig {
  /** Requests allowed per interval */
  count: number;
  /** Interval in seconds */
  intervalSec: number;
}

/**
 * Custom WAF rule for GCP Cloud Armor
 *
 * Uses CEL expressions and GCP-specific action formats.
 */
export interface GcpWafCustomRule {
  name: string;
  /** Rule priority (use 800-899 for custom rules) */
  priority: number;
  /** Action: deny(403), deny(404), deny(429), throttle, allow */
  action: string;
  /** CEL expression */
  expression: string;
  description?: string;
  /** Required if action is throttle */
  rateLimit?: WafRateLimitConfig;
}

/**
 * AWS WAF byte match configuration
 */
export interface AwsWafByteMatchConfig {
  searchString: string;
  fieldToMatch: 'uri_path' | 'query_string' | 'body' | 'header';
  /** Required when fieldToMatch is 'header' */
  headerName?: string;
  positionalConstraint: 'CONTAINS' | 'STARTS_WITH' | 'ENDS_WITH' | 'EXACTLY';
}

/**
 * AWS WAF geo match configuration
 */
export interface AwsWafGeoMatchConfig {
  /** ISO 3166-1 alpha-2 country codes */
  countryCodes: string[];
}

/**
 * Custom WAF rule for AWS WAF v2
 *
 * Uses AWS WAF statement-based constructs.
 */
export interface AwsWafCustomRule {
  name: string;
  /** Rule priority (100-899, managed rules use 1-99) */
  priority: number;
  action: 'block' | 'allow' | 'count';
  description?: string;
  matchType: 'byte_match' | 'rate_based' | 'geo_match';
  /** Required when matchType is 'byte_match' */
  byteMatch?: AwsWafByteMatchConfig;
  /** Required when matchType is 'geo_match' */
  geoMatch?: AwsWafGeoMatchConfig;
  /** Requests per 5-minute window, required when matchType is 'rate_based' */
  rateLimit?: number;
}

/**
 * WAF configuration
 *
 * Provider-specific rule types coexist on the same config.
 * Generators pick the relevant rules for their provider.
 */
export interface WafConfig {
  /** GCP Cloud Armor custom rules */
  gcpCustomRules?: GcpWafCustomRule[];
  /** AWS WAF v2 custom rules */
  awsCustomRules?: AwsWafCustomRule[];
}

// ---------------------------------------------------------------------------
// Base config — shared across all providers
// ---------------------------------------------------------------------------

/**
 * Base infrastructure configuration shared by all providers
 *
 * Contains all provider-agnostic fields. Provider-specific
 * extensions add their own fields via interface extension.
 */
export interface BaseInfraConfig {
  projectName: string;
  environment: string;

  // Compute
  services: Record<string, ServiceConfig>;
  frontends: Record<string, FrontendConfig>;
  spas: Record<string, SPAConfig>;
  workers: Record<string, WorkerConfig>;

  // Data
  database: DatabaseConfig;
  redis: RedisConfig;
  servicesWithDatabase: ServiceDatabaseInfo[];

  // Networking / Edge
  baseDomain: string;
  waf?: WafConfig;
  /** Add X-Robots-Tag: noindex, nofollow header */
  noIndex?: boolean;

  // Scheduling
  scheduledJobs: Record<string, ScheduledJobConfig>;

  // Registry
  /** Map of all deployables (services + workers + kong) for container registry */
  allDeployables: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Provider extensions — discriminated union
// ---------------------------------------------------------------------------

export interface AzureInfraConfig extends BaseInfraConfig {
  provider: 'azure';
  subscriptionId: string;
  location: string;
  storageAccountName: string;
  /** Enable Front Door Premium tier (Private Link origins, DRS 2.1 managed WAF rulesets) */
  frontdoorPremium: boolean;
  /** Kong App Service Plan SKU (e.g., B1, S1) */
  kongAppServiceSku: string;
  /** Next.js App Service Plan SKU (e.g., B1, S1) */
  nextjsAppServiceSku: string;
  /** Skip custom domain associations in routes and security policy (for two-phase deploy recovery) */
  skipCustomDomainAssociations?: boolean;
}

export interface AWSInfraConfig extends BaseInfraConfig {
  provider: 'aws';
  accountId: string;
  region: string;
  stateBucket: string;
  lockTable: string;
}

export interface GCPInfraConfig extends BaseInfraConfig {
  provider: 'gcp';
  gcpProjectId: string;
  region: string;
  stateBucket: string;
}

/**
 * Discriminated union of all provider configs.
 * Narrow via `config.provider` to access provider-specific fields.
 */
export type InfraConfig = AzureInfraConfig | AWSInfraConfig | GCPInfraConfig;
