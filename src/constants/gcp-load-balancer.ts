/**
 * GCP load balancer type
 */

/**
 * Classic Application Load Balancer. Set explicitly: provider 8 changed the
 * default to EXTERNAL_MANAGED (Global external Application Load Balancer),
 * which existing environments can't switch to in place, and whose WAF and CDN
 * behavior differs from what the framework sets up.
 */
export const GCP_LOAD_BALANCING_SCHEME = 'EXTERNAL';
