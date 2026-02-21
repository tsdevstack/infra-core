/**
 * Generate edge security policy for SPA backend buckets
 *
 * Backend buckets don't support security_policy, only edge_security_policy.
 *
 * LIMITATION: Edge policies only support allow/deny actions.
 * No redirect, throttle, or WAF rules. SPAs cannot have password protection.
 */

/**
 * Generate edge security policy for SPA backend buckets
 */
export function generateSpaEdgeSecurityPolicy(): string {
  return `
# =============================================================================
# Edge Security Policy for SPA Backend Buckets
# =============================================================================
# Backend buckets only support edge_security_policy (CLOUD_ARMOR_EDGE).
# LIMITATION: Edge policies only support allow/deny - no redirect/throttle/WAF.
# SPAs cannot have password protection via Cloud Armor.

resource "google_compute_security_policy" "spa_edge" {
  name        = "\${var.project_name}-spa-edge-policy"
  description = "Edge security policy for SPA backend buckets"
  type        = "CLOUD_ARMOR_EDGE"

  # Default rule: allow all traffic
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
}
`;
}
