/**
 * Generate Terraform Load Balancer Configuration
 *
 * Creates External HTTP(S) Load Balancer with host-based routing:
 * - Kong Gateway for API traffic (api.{domain})
 * - Frontend services for their configured domains (Cloud Run or SPA)
 * - Default 404 for unmatched hosts
 *
 * Includes:
 * - Static IP reservation
 * - Serverless NEGs for Kong and Cloud Run frontends
 * - Cloud Storage buckets with CDN for SPAs
 * - URL map with host-based routing
 * - Certificate Manager with DNS Authorization (100 domain limit)
 * - HTTPS proxy and forwarding rule
 * - HTTP to HTTPS redirect
 */

import type {
  FrontendHostingType,
  GcpWafCustomRule,
} from '../../types/index.ts';
import { toTerraformId } from '../../utils/terraform/to-terraform-id.ts';
import { toDnsAuthName } from '../../utils/gcp/to-dns-auth-name.ts';
import { generateCustomWafRules } from './generate-custom-waf-rules.ts';
import { generateSpaEdgeSecurityPolicy } from './generate-spa-edge-security-policy.ts';

/**
 * Frontend service with its domain and hosting type
 */
export interface FrontendServiceConfig {
  /** Service name (e.g., "frontend", "admin-app") */
  name: string;
  /** Full domain (e.g., "example.com", "admin.example.com") */
  domain: string;
  /** Hosting type: "cloudrun" (default) or "spa" */
  type?: FrontendHostingType;
}

export interface LoadBalancerConfig {
  /** API domain for Kong (e.g., "api.example.com") */
  apiDomain: string;
  /** Frontend services with their domains */
  frontendServices: FrontendServiceConfig[];
  /** Custom WAF rules from infrastructure.json */
  customWafRules?: GcpWafCustomRule[];
  /** Redirect domains (e.g., ["example.com", "example.dev"]) - all redirect to canonicalDomain */
  redirectDomains?: string[];
  /** Canonical domain to redirect to (e.g., "example.io") */
  canonicalDomain?: string;
  /** Add X-Robots-Tag: noindex, nofollow header to prevent search engine indexing */
  noIndex?: boolean;
}

/**
 * Generate loadbalancer.tf with host-based routing
 */
export function generateLoadBalancerTf(config: LoadBalancerConfig): string {
  const {
    apiDomain,
    frontendServices,
    customWafRules,
    redirectDomains,
    canonicalDomain,
    noIndex,
  } = config;

  // Generate custom WAF rules if any
  const customRulesHcl = generateCustomWafRules(customWafRules || []);

  // Split services by type
  const cloudRunServices = frontendServices.filter((s) => s.type !== 'spa');
  const spaServices = frontendServices.filter((s) => s.type === 'spa');

  // Generate Cloud Run NEGs
  const cloudRunNegs = cloudRunServices
    .map(
      (service) => `
# Serverless NEG for ${service.name}
resource "google_compute_region_network_endpoint_group" "${toTerraformId(service.name)}_neg" {
  name                  = "\${var.project_name}-${service.name}-neg"
  network_endpoint_type = "SERVERLESS"
  region                = var.gcp_region

  cloud_run {
    service = "${service.name}"
  }
}`,
    )
    .join('\n');

  // Build security headers list (conditionally includes X-Robots-Tag for noIndex)
  const securityHeaders = [
    '"Strict-Transport-Security: max-age=63072000; includeSubDomains; preload"',
    '"X-Content-Type-Options: nosniff"',
    '"X-Frame-Options: DENY"',
    '"Referrer-Policy: strict-origin-when-cross-origin"',
    '"Permissions-Policy: camera=(), microphone=(), geolocation=()"',
    ...(noIndex ? ['"X-Robots-Tag: noindex, nofollow"'] : []),
  ];

  // Generate Cloud Run backend services (with CDN for static asset caching and security headers)
  const cloudRunBackends = cloudRunServices
    .map(
      (service) => `
# Backend service for ${service.name} (with CDN and security headers)
resource "google_compute_backend_service" "${toTerraformId(service.name)}" {
  name            = "\${var.project_name}-${service.name}-backend"
  protocol        = "HTTPS"
  security_policy = google_compute_security_policy.default.id
  enable_cdn      = true

  # Security headers applied at load balancer level
  custom_response_headers = [
    ${securityHeaders.join(',\n    ')}
  ]

  cdn_policy {
    cache_mode                   = "USE_ORIGIN_HEADERS"  # Trust Next.js/app cache headers
    serve_while_stale            = 86400                  # Serve stale while revalidating
    negative_caching             = true                   # Cache 404s
    signed_url_cache_max_age_sec = 0                      # No signed URLs needed
  }

  backend {
    group = google_compute_region_network_endpoint_group.${toTerraformId(service.name)}_neg.id
  }
}`,
    )
    .join('\n');

  // Generate IAM bindings for Cloud Run services behind the LB
  // Services with ingress=internal-load-balancing need allUsers invoker permission
  const cloudRunIamBindings = cloudRunServices
    .map(
      (service) => `
# IAM binding to allow Load Balancer to invoke ${service.name}
resource "google_cloud_run_service_iam_member" "${toTerraformId(service.name)}_invoker" {
  location = var.gcp_region
  service  = "${service.name}"
  role     = "roles/run.invoker"
  member   = "allUsers"
}`,
    )
    .join('\n');

  // Reference existing SPA buckets (created in base infrastructure spa-buckets.tf)
  const spaBucketData = spaServices
    .map(
      (service) => `
# Reference existing SPA bucket for ${service.name} (created in spa-buckets.tf)
data "google_storage_bucket" "${toTerraformId(service.name)}_spa" {
  name = "\${var.project_name}-${service.name}-spa-\${var.gcp_project_id}"
}`,
    )
    .join('\n');

  // Generate SPA edge security policy (only if there are SPA services)
  const spaEdgePolicy =
    spaServices.length > 0 ? generateSpaEdgeSecurityPolicy() : '';

  // Generate SPA backend buckets (with CDN + edge security policy) - references data source
  // NOTE: google_compute_backend_bucket does NOT support custom_response_headers or security_policy
  // SPAs get security headers from index.html meta tags or app-level code if needed
  // Edge security policy provides auth redirect + DDoS protection for static content
  const spaBackendBuckets = spaServices
    .map(
      (service) => `
# Backend bucket with CDN for ${service.name} SPA
# NOTE: Backend buckets don't support custom_response_headers (GCP limitation)
# Uses edge_security_policy for auth redirect and DDoS protection
resource "google_compute_backend_bucket" "${toTerraformId(service.name)}_spa_backend" {
  name                 = "\${var.project_name}-${service.name}-spa-backend"
  bucket_name          = data.google_storage_bucket.${toTerraformId(service.name)}_spa.name
  enable_cdn           = true
  edge_security_policy = google_compute_security_policy.spa_edge.id

  cdn_policy {
    cache_mode        = "CACHE_ALL_STATIC"
    default_ttl       = 3600
    max_ttl           = 86400
    negative_caching  = true
    serve_while_stale = 86400
  }
}`,
    )
    .join('\n');

  // Generate host rules for all frontends
  // Note: path_matcher name must be kebab-case (GCP requirement), not underscore
  const frontendHostRules = frontendServices
    .map(
      (service) => `
  host_rule {
    hosts        = ["${service.domain}"]
    path_matcher = "${service.name}"
  }`,
    )
    .join('\n');

  // Generate path matchers for Cloud Run frontends
  // Note: name must be kebab-case (GCP requirement), resource refs use underscore (Terraform requirement)
  const cloudRunPathMatchers = cloudRunServices
    .map(
      (service) => `
  path_matcher {
    name            = "${service.name}"
    default_service = google_compute_backend_service.${toTerraformId(service.name)}.id
  }`,
    )
    .join('\n');

  // Generate path matchers for SPA frontends
  const spaPathMatchers = spaServices
    .map(
      (service) => `
  path_matcher {
    name            = "${service.name}"
    default_service = google_compute_backend_bucket.${toTerraformId(service.name)}_spa_backend.id
  }`,
    )
    .join('\n');

  // Generate depends_on for URL map
  const urlMapDependsOn = [
    'google_compute_backend_service.kong',
    ...cloudRunServices.map(
      (s) => `google_compute_backend_service.${toTerraformId(s.name)}`,
    ),
    ...spaServices.map(
      (s) =>
        `google_compute_backend_bucket.${toTerraformId(s.name)}_spa_backend`,
    ),
  ];

  // Generate redirect domain resources (wildcard certs for apex + *.domain)
  const hasRedirects =
    redirectDomains && redirectDomains.length > 0 && canonicalDomain;

  // Generate redirect domain host rules for URL map
  const redirectHostRules = hasRedirects
    ? redirectDomains
        .map(
          (domain) => `
  # Redirect ${domain} and *.${domain} to ${canonicalDomain}
  host_rule {
    hosts        = ["${domain}", "*.${domain}"]
    path_matcher = "redirect-${toDnsAuthName(domain)}"
  }`,
        )
        .join('\n')
    : '';

  // Generate redirect path matchers
  const redirectPathMatchers = hasRedirects
    ? redirectDomains
        .map(
          (domain) => `
  path_matcher {
    name = "redirect-${toDnsAuthName(domain)}"
    default_url_redirect {
      host_redirect          = "${canonicalDomain}"
      https_redirect         = true
      redirect_response_code = "MOVED_PERMANENTLY_DEFAULT"
      strip_query            = false
    }
  }`,
        )
        .join('\n')
    : '';

  // Generate redirect DNS authorizations
  const redirectDnsAuths = hasRedirects
    ? redirectDomains
        .map(
          (domain) => `
# DNS authorization for redirect domain ${domain} (covers both apex and *.${domain})
resource "google_certificate_manager_dns_authorization" "redirect_${toTerraformId(toDnsAuthName(domain))}" {
  name   = "\${var.project_name}-dns-redirect-${toDnsAuthName(domain)}"
  domain = "${domain}"

  lifecycle {
    create_before_destroy = true
  }
}`,
        )
        .join('\n')
    : '';

  // Generate redirect wildcard certificates
  const redirectCerts = hasRedirects
    ? redirectDomains
        .map(
          (domain) => `
# Wildcard certificate for redirect domain ${domain} (covers apex + *.${domain})
resource "google_certificate_manager_certificate" "redirect_${toTerraformId(toDnsAuthName(domain))}" {
  name = "\${var.project_name}-cert-redirect-${toDnsAuthName(domain)}"

  managed {
    domains            = ["${domain}", "*.${domain}"]
    dns_authorizations = [google_certificate_manager_dns_authorization.redirect_${toTerraformId(toDnsAuthName(domain))}.id]
  }

  lifecycle {
    create_before_destroy = true
  }
}`,
        )
        .join('\n')
    : '';

  // Generate redirect certificate map entries (apex + wildcard for each domain)
  const redirectCertMapEntries = hasRedirects
    ? redirectDomains
        .map(
          (domain) => `
# Certificate map entry for ${domain} (apex)
resource "google_certificate_manager_certificate_map_entry" "redirect_${toTerraformId(toDnsAuthName(domain))}" {
  name         = "\${var.project_name}-entry-redirect-${toDnsAuthName(domain)}"
  map          = google_certificate_manager_certificate_map.main.name
  certificates = [google_certificate_manager_certificate.redirect_${toTerraformId(toDnsAuthName(domain))}.id]
  hostname     = "${domain}"
}

# Certificate map entry for *.${domain} (wildcard)
resource "google_certificate_manager_certificate_map_entry" "redirect_${toTerraformId(toDnsAuthName(domain))}_wildcard" {
  name         = "\${var.project_name}-entry-redirect-${toDnsAuthName(domain)}-wildcard"
  map          = google_certificate_manager_certificate_map.main.name
  certificates = [google_certificate_manager_certificate.redirect_${toTerraformId(toDnsAuthName(domain))}.id]
  hostname     = "*.${domain}"
}`,
        )
        .join('\n')
    : '';

  // Generate redirect DNS auth outputs
  const redirectDnsAuthOutputs = hasRedirects
    ? redirectDomains
        .map(
          (domain) => `
output "dns_auth_redirect_${toTerraformId(toDnsAuthName(domain))}_record" {
  description = "CNAME record for redirect domain ${domain} SSL validation"
  value = {
    name = google_certificate_manager_dns_authorization.redirect_${toTerraformId(toDnsAuthName(domain))}.dns_resource_record[0].name
    type = google_certificate_manager_dns_authorization.redirect_${toTerraformId(toDnsAuthName(domain))}.dns_resource_record[0].type
    data = google_certificate_manager_dns_authorization.redirect_${toTerraformId(toDnsAuthName(domain))}.dns_resource_record[0].data
  }
}`,
        )
        .join('\n')
    : '';

  return `# External HTTP(S) Load Balancer with Host-Based Routing
# Generated by: npx tsdevstack infra:deploy-lb
#
# Routes:
#   ${apiDomain} -> Kong Gateway
${frontendServices.map((s) => `#   ${s.domain} -> ${s.name}`).join('\n')}

# Reserve static IP for load balancer (single IP for all domains)
resource "google_compute_global_address" "lb" {
  name = "\${var.project_name}-lb-ip"
}

# =============================================================================
# Cloud Armor Security Policy (WAF) - Optimized for REST APIs
# =============================================================================
#
# Key settings:
# - JSON Parsing: STANDARD (required for REST APIs to avoid false positives)
# - Verbose Logging: Enabled (essential for debugging/tuning)
# - Sensitivity Level 1: High-confidence signatures, minimal false positives
# - CRS 3.3 (v33-stable): Latest OWASP ModSecurity Core Rule Set

resource "google_compute_security_policy" "default" {
  name        = "\${var.project_name}-security-policy"
  description = "Cloud Armor security policy optimized for REST APIs"

  # CRITICAL: JSON parsing prevents false positives on JSON payloads
  advanced_options_config {
    json_parsing = "STANDARD"
    log_level    = "VERBOSE"
  }

  # Adaptive Protection - ML-based DDoS detection
  adaptive_protection_config {
    layer_7_ddos_defense_config {
      enable          = true
      rule_visibility = "STANDARD"
    }
  }

  # Default rule: allow all traffic (WAF rules above filter malicious requests)
  rule {
    action   = "allow"
    priority = "2147483647"
    match {
      versioned_expr = "SRC_IPS_V1"
      config {
        src_ip_ranges = ["*"]
      }
    }
    description = "Default rule - allow all traffic"
  }

  # SQL Injection (OWASP A03:2021)
  rule {
    action   = "deny(403)"
    priority = "1000"
    match {
      expr {
        expression = "evaluatePreconfiguredWaf('sqli-v33-stable', {'sensitivity': 1})"
      }
    }
    description = "Block SQL injection attacks"
  }

  # Cross-Site Scripting (OWASP A03:2021)
  rule {
    action   = "deny(403)"
    priority = "1001"
    match {
      expr {
        expression = "evaluatePreconfiguredWaf('xss-v33-stable', {'sensitivity': 1})"
      }
    }
    description = "Block XSS attacks"
  }

  # Remote Code Execution (OWASP A03:2021)
  rule {
    action   = "deny(403)"
    priority = "1002"
    match {
      expr {
        expression = "evaluatePreconfiguredWaf('rce-v33-stable', {'sensitivity': 1})"
      }
    }
    description = "Block remote code execution attacks"
  }

  # Local File Inclusion (OWASP A01:2021)
  rule {
    action   = "deny(403)"
    priority = "1003"
    match {
      expr {
        expression = "evaluatePreconfiguredWaf('lfi-v33-stable', {'sensitivity': 1})"
      }
    }
    description = "Block local file inclusion attacks"
  }

  # Remote File Inclusion (OWASP A01:2021)
  rule {
    action   = "deny(403)"
    priority = "1004"
    match {
      expr {
        expression = "evaluatePreconfiguredWaf('rfi-v33-stable', {'sensitivity': 1})"
      }
    }
    description = "Block remote file inclusion attacks"
  }

  # Protocol Attacks - HTTP smuggling, header injection (OWASP A05:2021)
  rule {
    action   = "deny(403)"
    priority = "1005"
    match {
      expr {
        expression = "evaluatePreconfiguredWaf('protocolattack-v33-stable', {'sensitivity': 1})"
      }
    }
    description = "Block protocol attacks"
  }

  # Session Fixation (OWASP A07:2021)
  rule {
    action   = "deny(403)"
    priority = "1006"
    match {
      expr {
        expression = "evaluatePreconfiguredWaf('sessionfixation-v33-stable', {'sensitivity': 1})"
      }
    }
    description = "Block session fixation attacks"
  }

  # Scanner Detection - blocks known vulnerability scanners
  rule {
    action   = "deny(403)"
    priority = "1007"
    match {
      expr {
        expression = "evaluatePreconfiguredWaf('scannerdetection-v33-stable', {'sensitivity': 1})"
      }
    }
    description = "Block known vulnerability scanners"
  }

  # Node.js specific attacks (prototype pollution, etc.)
  rule {
    action   = "deny(403)"
    priority = "1008"
    match {
      expr {
        expression = "evaluatePreconfiguredWaf('nodejs-v33-stable', {'sensitivity': 1})"
      }
    }
    description = "Block Node.js specific attacks"
  }

  # SSRF Protection - Block cloud metadata endpoint
  rule {
    action   = "deny(403)"
    priority = "900"
    match {
      expr {
        expression = "request.path.matches('.*169\\\\\\\\.254\\\\\\\\.169\\\\\\\\.254.*') || request.headers['host'].lower().contains('metadata.google.internal') || request.query.lower().contains('169.254.169.254')"
      }
    }
    description = "Block SSRF to cloud metadata"
  }
${customRulesHcl}
  # Rate limiting: 1000 requests per minute per IP
  rule {
    action   = "throttle"
    priority = "2000"
    match {
      versioned_expr = "SRC_IPS_V1"
      config {
        src_ip_ranges = ["*"]
      }
    }
    rate_limit_options {
      conform_action = "allow"
      exceed_action  = "deny(429)"
      rate_limit_threshold {
        count        = 1000
        interval_sec = 60
      }
      enforce_on_key = "IP"
    }
    description = "Rate limit: 1000 requests/min per IP"
  }
}

# =============================================================================
# Kong Gateway Backend
# =============================================================================

# Serverless NEG pointing to Kong
resource "google_compute_region_network_endpoint_group" "kong_neg" {
  name                  = "\${var.project_name}-kong-neg"
  network_endpoint_type = "SERVERLESS"
  region                = var.gcp_region

  cloud_run {
    service = "\${var.project_name}-kong"
  }
}

# Backend service for Kong (with security headers)
resource "google_compute_backend_service" "kong" {
  name            = "\${var.project_name}-kong-backend"
  protocol        = "HTTPS"
  security_policy = google_compute_security_policy.default.id

  # Security headers applied at load balancer level
  custom_response_headers = [
    "Strict-Transport-Security: max-age=63072000; includeSubDomains; preload",
    "X-Content-Type-Options: nosniff",
    "X-Frame-Options: DENY",
    "Referrer-Policy: strict-origin-when-cross-origin",
    "Permissions-Policy: camera=(), microphone=(), geolocation=()"
  ]

  backend {
    group = google_compute_region_network_endpoint_group.kong_neg.id
  }
}

# =============================================================================
# Cloud Run Frontend Backends
# =============================================================================
${cloudRunNegs}
${cloudRunBackends}

# =============================================================================
# IAM Bindings (Allow Load Balancer to invoke Cloud Run services)
# =============================================================================

# IAM binding to allow Load Balancer to invoke Kong
resource "google_cloud_run_service_iam_member" "kong_invoker" {
  location = var.gcp_region
  service  = "\${var.project_name}-kong"
  role     = "roles/run.invoker"
  member   = "allUsers"
}
${cloudRunIamBindings}

# =============================================================================
# SPA Backends (Cloud Storage + CDN)
# =============================================================================
${spaEdgePolicy}
${spaBucketData}
${spaBackendBuckets}

# =============================================================================
# URL Map with Host-Based Routing
# =============================================================================

# URL map routes traffic based on hostname
resource "google_compute_url_map" "main" {
  name = "\${var.project_name}-urlmap"

  # Default: Kong for API traffic (catches unmatched hosts too)
  default_service = google_compute_backend_service.kong.id

  # Kong API host rule
  host_rule {
    hosts        = ["${apiDomain}"]
    path_matcher = "kong"
  }
${frontendHostRules}
${redirectHostRules}

  # Kong path matcher
  path_matcher {
    name            = "kong"
    default_service = google_compute_backend_service.kong.id
  }
${cloudRunPathMatchers}
${spaPathMatchers}
${redirectPathMatchers}

  depends_on = [${urlMapDependsOn.join(', ')}]
}

# =============================================================================
# SSL Certificate (Certificate Manager with DNS Authorization)
# =============================================================================

# DNS authorization for API domain
resource "google_certificate_manager_dns_authorization" "api" {
  name   = "\${var.project_name}-dns-${toDnsAuthName(apiDomain)}"
  domain = "${apiDomain}"

  lifecycle {
    create_before_destroy = true
  }
}
${frontendServices
  .map(
    (s) => `
# DNS authorization for ${s.name} (${s.domain})
resource "google_certificate_manager_dns_authorization" "${toTerraformId(s.name)}" {
  name   = "\${var.project_name}-dns-${toDnsAuthName(s.domain)}"
  domain = "${s.domain}"

  lifecycle {
    create_before_destroy = true
  }
}`,
  )
  .join('\n')}
${redirectDnsAuths}

# Per-domain certificates (isolates domains - adding/removing one doesn't affect others)
# API domain certificate
resource "google_certificate_manager_certificate" "api" {
  name = "\${var.project_name}-cert-${toDnsAuthName(apiDomain)}"

  managed {
    domains            = ["${apiDomain}"]
    dns_authorizations = [google_certificate_manager_dns_authorization.api.id]
  }

  lifecycle {
    create_before_destroy = true
  }
}
${frontendServices
  .map(
    (s) => `
# Certificate for ${s.name} (${s.domain})
resource "google_certificate_manager_certificate" "${toTerraformId(s.name)}" {
  name = "\${var.project_name}-cert-${toDnsAuthName(s.domain)}"

  managed {
    domains            = ["${s.domain}"]
    dns_authorizations = [google_certificate_manager_dns_authorization.${toTerraformId(s.name)}.id]
  }

  lifecycle {
    create_before_destroy = true
  }
}`,
  )
  .join('\n')}
${redirectCerts}

# Certificate map
resource "google_certificate_manager_certificate_map" "main" {
  name = "\${var.project_name}-cert-map"
}

# Per-domain certificate map entries (hostname matcher instead of PRIMARY)
resource "google_certificate_manager_certificate_map_entry" "api" {
  name         = "\${var.project_name}-entry-api"
  map          = google_certificate_manager_certificate_map.main.name
  certificates = [google_certificate_manager_certificate.api.id]
  hostname     = "${apiDomain}"
}
${frontendServices
  .map(
    (s) => `
resource "google_certificate_manager_certificate_map_entry" "${toTerraformId(s.name)}" {
  name         = "\${var.project_name}-entry-${s.name}"
  map          = google_certificate_manager_certificate_map.main.name
  certificates = [google_certificate_manager_certificate.${toTerraformId(s.name)}.id]
  hostname     = "${s.domain}"
}`,
  )
  .join('\n')}
${redirectCertMapEntries}

# =============================================================================
# HTTPS Proxy and Forwarding
# =============================================================================

# HTTPS proxy (uses certificate map for Certificate Manager)
resource "google_compute_target_https_proxy" "main" {
  name            = "\${var.project_name}-https-proxy"
  url_map         = google_compute_url_map.main.id
  certificate_map = "//certificatemanager.googleapis.com/\${google_certificate_manager_certificate_map.main.id}"

  depends_on = [google_compute_url_map.main, google_certificate_manager_certificate_map_entry.api]
}

# Forwarding rule (connects IP to proxy)
resource "google_compute_global_forwarding_rule" "https" {
  name       = "\${var.project_name}-https"
  ip_address = google_compute_global_address.lb.address
  port_range = "443"
  target     = google_compute_target_https_proxy.main.id

  depends_on = [google_compute_target_https_proxy.main]
}

# =============================================================================
# HTTP to HTTPS Redirect
# =============================================================================

resource "google_compute_url_map" "http_redirect" {
  name = "\${var.project_name}-http-redirect"

  default_url_redirect {
    https_redirect         = true
    redirect_response_code = "MOVED_PERMANENTLY_DEFAULT"
    strip_query            = false
  }
}

resource "google_compute_target_http_proxy" "redirect" {
  name    = "\${var.project_name}-http-redirect-proxy"
  url_map = google_compute_url_map.http_redirect.id
}

resource "google_compute_global_forwarding_rule" "http_redirect" {
  name       = "\${var.project_name}-http-redirect"
  ip_address = google_compute_global_address.lb.address
  port_range = "80"
  target     = google_compute_target_http_proxy.redirect.id
}

# =============================================================================
# Outputs
# =============================================================================

output "load_balancer_ip" {
  description = "Static IP address for the load balancer"
  value       = google_compute_global_address.lb.address
}

output "api_url" {
  description = "URL for the API endpoint (Kong)"
  value       = "https://${apiDomain}"
}

output "dns_auth_api_record" {
  description = "CNAME record for API domain SSL validation"
  value = {
    name = google_certificate_manager_dns_authorization.api.dns_resource_record[0].name
    type = google_certificate_manager_dns_authorization.api.dns_resource_record[0].type
    data = google_certificate_manager_dns_authorization.api.dns_resource_record[0].data
  }
}
${frontendServices
  .map(
    (s) => `
output "dns_auth_${toTerraformId(s.name)}_record" {
  description = "CNAME record for ${s.name} domain SSL validation"
  value = {
    name = google_certificate_manager_dns_authorization.${toTerraformId(s.name)}.dns_resource_record[0].name
    type = google_certificate_manager_dns_authorization.${toTerraformId(s.name)}.dns_resource_record[0].type
    data = google_certificate_manager_dns_authorization.${toTerraformId(s.name)}.dns_resource_record[0].data
  }
}`,
  )
  .join('\n')}
${frontendServices
  .map(
    (s) => `
output "${toTerraformId(s.name)}_url" {
  description = "URL for ${s.name}"
  value       = "https://${s.domain}"
}`,
  )
  .join('')}
${redirectDnsAuthOutputs}
`;
}
