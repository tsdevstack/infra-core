import { describe, it, expect } from '@rstest/core';
import { generateLoadBalancerTf } from './generate-loadbalancer-tf';

describe('generateLoadBalancerTf', () => {
  describe('API-only deployment (no frontends)', () => {
    it('should generate terraform with only Kong backend', () => {
      const result = generateLoadBalancerTf({
        apiDomain: 'api.example.com',
        frontendServices: [],
      });

      // Should have Kong NEG
      expect(result).toContain(
        'resource "google_compute_region_network_endpoint_group" "kong_neg"',
      );
      expect(result).toContain(
        'resource "google_compute_backend_service" "kong"',
      );

      // Should have Kong host rule
      expect(result).toContain('hosts        = ["api.example.com"]');
      expect(result).toContain('path_matcher = "kong"');

      // Should have per-domain certificate for API
      expect(result).toContain(
        'resource "google_certificate_manager_certificate" "api"',
      );
      expect(result).toContain('domain = "api.example.com"');

      // Should NOT have frontend backends
      expect(result).not.toContain(
        'resource "google_compute_backend_service" "frontend"',
      );
    });
  });

  describe('with frontend services', () => {
    it('should generate NEGs and backends for each frontend', () => {
      const result = generateLoadBalancerTf({
        apiDomain: 'api.example.com',
        frontendServices: [
          { name: 'frontend', domain: 'example.com' },
          { name: 'admin-app', domain: 'admin.example.com' },
        ],
      });

      // Should have frontend NEGs
      expect(result).toContain(
        'resource "google_compute_region_network_endpoint_group" "frontend_neg"',
      );
      expect(result).toContain(
        'resource "google_compute_region_network_endpoint_group" "admin_app_neg"',
      );

      // Should have frontend backends
      expect(result).toContain(
        'resource "google_compute_backend_service" "frontend"',
      );
      expect(result).toContain(
        'resource "google_compute_backend_service" "admin_app"',
      );

      // Should have host rules for frontends
      expect(result).toContain('hosts        = ["example.com"]');
      expect(result).toContain('hosts        = ["admin.example.com"]');

      // Should have path matchers for frontends (kebab-case names for GCP)
      expect(result).toContain('name            = "frontend"');
      expect(result).toContain('name            = "admin-app"');
    });

    it('should include all domains in SSL certificate', () => {
      const result = generateLoadBalancerTf({
        apiDomain: 'api.example.com',
        frontendServices: [
          { name: 'frontend', domain: 'example.com' },
          { name: 'admin-app', domain: 'admin.example.com' },
        ],
      });

      // Certificate should include all domains
      expect(result).toContain('"api.example.com"');
      expect(result).toContain('"example.com"');
      expect(result).toContain('"admin.example.com"');
    });
  });

  describe('Certificate Manager with DNS Authorization', () => {
    it('should create DNS authorization for API domain', () => {
      const result = generateLoadBalancerTf({
        apiDomain: 'api.example.com',
        frontendServices: [],
      });

      expect(result).toContain(
        'resource "google_certificate_manager_dns_authorization" "api"',
      );
      expect(result).toContain('domain = "api.example.com"');
    });

    it('should create DNS authorization for each frontend', () => {
      const result = generateLoadBalancerTf({
        apiDomain: 'api.example.com',
        frontendServices: [
          { name: 'frontend', domain: 'example.com' },
          { name: 'admin-app', domain: 'admin.example.com' },
        ],
      });

      expect(result).toContain(
        'resource "google_certificate_manager_dns_authorization" "frontend"',
      );
      expect(result).toContain(
        'resource "google_certificate_manager_dns_authorization" "admin_app"',
      );
    });

    it('should create per-domain certificates with DNS authorizations', () => {
      const result = generateLoadBalancerTf({
        apiDomain: 'api.example.com',
        frontendServices: [],
      });

      // Uses per-domain certificates, not a single "main" certificate
      expect(result).toContain(
        'resource "google_certificate_manager_certificate" "api"',
      );
      expect(result).toContain('dns_authorizations = [');
    });

    it('should create certificate map and per-domain entries', () => {
      const result = generateLoadBalancerTf({
        apiDomain: 'api.example.com',
        frontendServices: [],
      });

      expect(result).toContain(
        'resource "google_certificate_manager_certificate_map" "main"',
      );
      // Uses per-domain hostname entries instead of PRIMARY matcher
      expect(result).toContain(
        'resource "google_certificate_manager_certificate_map_entry" "api"',
      );
      expect(result).toContain('hostname     = "api.example.com"');
    });

    it('should use certificate_map in HTTPS proxy', () => {
      const result = generateLoadBalancerTf({
        apiDomain: 'api.example.com',
        frontendServices: [],
      });

      expect(result).toContain(
        'certificate_map = "//certificatemanager.googleapis.com/',
      );
    });
  });

  describe('DNS authorization outputs', () => {
    it('should output DNS auth record for API domain', () => {
      const result = generateLoadBalancerTf({
        apiDomain: 'api.example.com',
        frontendServices: [],
      });

      expect(result).toContain('output "dns_auth_api_record"');
    });

    it('should output DNS auth records for frontends', () => {
      const result = generateLoadBalancerTf({
        apiDomain: 'api.example.com',
        frontendServices: [{ name: 'frontend', domain: 'example.com' }],
      });

      expect(result).toContain('output "dns_auth_frontend_record"');
    });
  });

  describe('HTTP to HTTPS redirect', () => {
    it('should include HTTP redirect configuration', () => {
      const result = generateLoadBalancerTf({
        apiDomain: 'api.example.com',
        frontendServices: [],
      });

      expect(result).toContain(
        'resource "google_compute_url_map" "http_redirect"',
      );
      expect(result).toContain('https_redirect         = true');
      expect(result).toContain(
        'redirect_response_code = "MOVED_PERMANENTLY_DEFAULT"',
      );
    });
  });

  describe('outputs', () => {
    it('should output load balancer IP', () => {
      const result = generateLoadBalancerTf({
        apiDomain: 'api.example.com',
        frontendServices: [],
      });

      expect(result).toContain('output "load_balancer_ip"');
    });

    it('should output API URL', () => {
      const result = generateLoadBalancerTf({
        apiDomain: 'api.example.com',
        frontendServices: [],
      });

      expect(result).toContain('output "api_url"');
      expect(result).toContain('https://api.example.com');
    });

    it('should output frontend URLs', () => {
      const result = generateLoadBalancerTf({
        apiDomain: 'api.example.com',
        frontendServices: [
          { name: 'frontend', domain: 'example.com' },
          { name: 'admin-app', domain: 'admin.example.com' },
        ],
      });

      expect(result).toContain('output "frontend_url"');
      expect(result).toContain('output "admin_app_url"');
      expect(result).toContain('https://example.com');
      expect(result).toContain('https://admin.example.com');
    });
  });

  describe('SPA backends (Cloud Storage + CDN)', () => {
    it('should reference existing SPA bucket via data source', () => {
      const result = generateLoadBalancerTf({
        apiDomain: 'api.example.com',
        frontendServices: [
          { name: 'react-app', domain: 'app.example.com', type: 'spa' },
        ],
      });

      // Should reference bucket resource from spa-buckets.tf (not data source)
      expect(result).not.toContain('data "google_storage_bucket"');
      expect(result).toContain('google_storage_bucket.react_app_spa.name');
    });

    it('should generate backend bucket with CDN for SPA services', () => {
      const result = generateLoadBalancerTf({
        apiDomain: 'api.example.com',
        frontendServices: [
          { name: 'react-app', domain: 'app.example.com', type: 'spa' },
        ],
      });

      expect(result).toContain(
        'resource "google_compute_backend_bucket" "react_app_spa_backend"',
      );
      expect(result).toContain('enable_cdn           = true');
      expect(result).toContain('cache_mode        = "CACHE_ALL_STATIC"');
    });

    it('should NOT generate NEG or backend_service for SPA services', () => {
      const result = generateLoadBalancerTf({
        apiDomain: 'api.example.com',
        frontendServices: [
          { name: 'react-app', domain: 'app.example.com', type: 'spa' },
        ],
      });

      // Should NOT have NEG for SPA
      expect(result).not.toContain(
        'resource "google_compute_region_network_endpoint_group" "react_app_neg"',
      );
      // Should NOT have backend_service for SPA
      expect(result).not.toContain(
        'resource "google_compute_backend_service" "react_app"',
      );
    });

    it('should handle mixed Cloud Run and SPA services', () => {
      const result = generateLoadBalancerTf({
        apiDomain: 'api.example.com',
        frontendServices: [
          { name: 'frontend', domain: 'example.com', type: 'cloudrun' },
          { name: 'react-app', domain: 'app.example.com', type: 'spa' },
        ],
      });

      // Cloud Run frontend
      expect(result).toContain(
        'resource "google_compute_region_network_endpoint_group" "frontend_neg"',
      );
      expect(result).toContain(
        'resource "google_compute_backend_service" "frontend"',
      );

      // SPA frontend (references bucket resource from spa-buckets.tf)
      expect(result).not.toContain('data "google_storage_bucket"');
      expect(result).toContain(
        'resource "google_compute_backend_bucket" "react_app_spa_backend"',
      );

      // Both should have host rules and DNS auth
      expect(result).toContain('hosts        = ["example.com"]');
      expect(result).toContain('hosts        = ["app.example.com"]');
      expect(result).toContain(
        'resource "google_certificate_manager_dns_authorization" "frontend"',
      );
      expect(result).toContain(
        'resource "google_certificate_manager_dns_authorization" "react_app"',
      );
    });
  });

  describe('Cloud Armor security policy', () => {
    it('should create default security policy', () => {
      const result = generateLoadBalancerTf({
        apiDomain: 'api.example.com',
        frontendServices: [],
      });

      expect(result).toContain(
        'resource "google_compute_security_policy" "default"',
      );
      expect(result).toContain(
        'Cloud Armor security policy optimized for REST APIs',
      );
    });

    it('should include SQL injection protection', () => {
      const result = generateLoadBalancerTf({
        apiDomain: 'api.example.com',
        frontendServices: [],
      });

      expect(result).toContain(
        "evaluatePreconfiguredWaf('sqli-v33-stable', {'sensitivity': 1})",
      );
      expect(result).toContain('Block SQL injection attacks');
    });

    it('should include XSS protection', () => {
      const result = generateLoadBalancerTf({
        apiDomain: 'api.example.com',
        frontendServices: [],
      });

      expect(result).toContain(
        `evaluatePreconfiguredWaf('xss-v33-stable', {'sensitivity': 1})`,
      );
      expect(result).toContain('Block XSS attacks');
    });

    it('should include SSRF protection for cloud metadata endpoint', () => {
      const result = generateLoadBalancerTf({
        apiDomain: 'api.example.com',
        frontendServices: [],
      });

      // Should block requests to GCP metadata endpoint
      expect(result).toContain('169.254.169.254');
      expect(result).toContain('metadata.google.internal');
      expect(result).toContain('Block SSRF to cloud metadata');
      expect(result).toContain('priority = "900"');
    });

    it('should include Node.js specific attack protection', () => {
      const result = generateLoadBalancerTf({
        apiDomain: 'api.example.com',
        frontendServices: [],
      });

      // Should block prototype pollution and other Node.js attacks
      expect(result).toContain(
        "evaluatePreconfiguredWaf('nodejs-v33-stable', {'sensitivity': 1})",
      );
      expect(result).toContain('Block Node.js specific attacks');
      expect(result).toContain('priority = "1008"');
    });

    it('should include rate limiting with defaults', () => {
      const result = generateLoadBalancerTf({
        apiDomain: 'api.example.com',
        frontendServices: [],
      });

      expect(result).toContain('action   = "throttle"');
      expect(result).toContain('count        = 1000');
      expect(result).toContain('interval_sec = 60');
    });

    it('should use custom rate limit when provided', () => {
      const result = generateLoadBalancerTf({
        apiDomain: 'api.example.com',
        frontendServices: [],
        rateLimit: { count: 500, intervalSec: 30 },
      });

      expect(result).toContain('count        = 500');
      expect(result).toContain('interval_sec = 30');
    });

    it('should attach security policy to Kong backend', () => {
      const result = generateLoadBalancerTf({
        apiDomain: 'api.example.com',
        frontendServices: [],
      });

      expect(result).toContain(
        'resource "google_compute_backend_service" "kong"',
      );
      expect(result).toContain(
        'security_policy = google_compute_security_policy.default.id',
      );
    });

    it('should attach security policy to Cloud Run frontend backends', () => {
      const result = generateLoadBalancerTf({
        apiDomain: 'api.example.com',
        frontendServices: [{ name: 'frontend', domain: 'example.com' }],
      });

      expect(result).toContain(
        'resource "google_compute_backend_service" "frontend"',
      );
      // Both Kong and frontend should have security_policy
      const matches = result.match(
        /security_policy = google_compute_security_policy\.default\.id/g,
      );
      expect(matches?.length).toBeGreaterThanOrEqual(2);
    });
  });
});
