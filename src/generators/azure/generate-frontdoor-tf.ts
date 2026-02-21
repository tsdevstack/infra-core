/**
 * Generate frontdoor.tf with Azure Front Door profile, security policy, endpoints, and origin groups
 * WAF policy is in generate-waf-tf.ts
 */

import type { AzureInfraConfig } from '../../types/config.ts';
import { toTerraformId } from '../../utils/terraform/to-terraform-id.ts';

export function generateFrontdoorTf(config: AzureInfraConfig): string {
  const nextjsEntries = Object.entries(config.frontends);
  const spaEntries = Object.entries(config.spas);

  // Next.js endpoint resources
  const nextjsEndpoints = nextjsEntries
    .map(
      ([name]) => `
resource "azurerm_cdn_frontdoor_endpoint" "nextjs_${toTerraformId(name)}" {
  name                     = "\${var.project_name}-\${var.environment}-${name}"
  cdn_frontdoor_profile_id = azurerm_cdn_frontdoor_profile.main.id
  tags                     = local.tags
}`,
    )
    .join('\n');

  // SPA endpoint resources
  const spaEndpoints = spaEntries
    .map(
      ([name]) => `
resource "azurerm_cdn_frontdoor_endpoint" "spa_${toTerraformId(name)}" {
  name                     = "\${var.project_name}-\${var.environment}-${name}"
  cdn_frontdoor_profile_id = azurerm_cdn_frontdoor_profile.main.id
  tags                     = local.tags
}`,
    )
    .join('\n');

  // Next.js security policy domain associations
  const nextjsSecurityDomains = nextjsEntries
    .map(
      ([name]) => `
        domain {
          cdn_frontdoor_domain_id = azurerm_cdn_frontdoor_endpoint.nextjs_${toTerraformId(name)}.id
        }`,
    )
    .join('\n');

  // SPA security policy domain associations
  const spaSecurityDomains = spaEntries
    .map(
      ([name]) => `
        domain {
          cdn_frontdoor_domain_id = azurerm_cdn_frontdoor_endpoint.spa_${toTerraformId(name)}.id
        }`,
    )
    .join('\n');

  // Custom domain security policy associations (when baseDomain is set)
  const customDomainSecurityDomains =
    config.baseDomain && !config.skipCustomDomainAssociations
      ? [
          `
        domain {
          cdn_frontdoor_domain_id = azurerm_cdn_frontdoor_custom_domain.api.id
        }`,
          ...nextjsEntries.map(
            ([name]) => `
        domain {
          cdn_frontdoor_domain_id = azurerm_cdn_frontdoor_custom_domain.nextjs_${toTerraformId(name)}.id
        }`,
          ),
          ...spaEntries.map(
            ([name]) => `
        domain {
          cdn_frontdoor_domain_id = azurerm_cdn_frontdoor_custom_domain.spa_${toTerraformId(name)}.id
        }`,
          ),
        ].join('\n')
      : '';

  // Next.js origin groups
  const nextjsOriginGroups = nextjsEntries
    .map(
      ([name]) => `
resource "azurerm_cdn_frontdoor_origin_group" "nextjs_${toTerraformId(name)}" {
  name                     = "\${var.project_name}-\${var.environment}-${name}-origin"
  cdn_frontdoor_profile_id = azurerm_cdn_frontdoor_profile.main.id
  session_affinity_enabled = false

  load_balancing {
    sample_size                 = 4
    successful_samples_required = 3
  }

  health_probe {
    path                = "/"
    protocol            = "Https"
    interval_in_seconds = 30
    request_type        = "HEAD"
  }
}`,
    )
    .join('\n');

  // SPA origin groups
  const spaOriginGroups = spaEntries
    .map(
      ([name]) => `
resource "azurerm_cdn_frontdoor_origin_group" "spa_${toTerraformId(name)}" {
  name                     = "\${var.project_name}-\${var.environment}-${name}-origin"
  cdn_frontdoor_profile_id = azurerm_cdn_frontdoor_profile.main.id
  session_affinity_enabled = false

  load_balancing {
    sample_size                 = 4
    successful_samples_required = 3
  }

  health_probe {
    path                = "/"
    protocol            = "Https"
    interval_in_seconds = 30
    request_type        = "HEAD"
  }
}`,
    )
    .join('\n');

  // Rule set reference for routes (when noIndex is enabled)
  const ruleSetIds = config.noIndex
    ? '\n  cdn_frontdoor_rule_set_ids    = [azurerm_cdn_frontdoor_rule_set.headers.id]'
    : '';

  // noIndex rule set (X-Robots-Tag: noindex, nofollow)
  const noIndexRuleSet = config.noIndex
    ? `

# =============================================================================
# Rule Set (response headers)
# =============================================================================

resource "azurerm_cdn_frontdoor_rule_set" "headers" {
  name                     = "responseheaders"
  cdn_frontdoor_profile_id = azurerm_cdn_frontdoor_profile.main.id
}

resource "azurerm_cdn_frontdoor_rule" "noindex" {
  name                      = "AddNoIndexHeader"
  cdn_frontdoor_rule_set_id = azurerm_cdn_frontdoor_rule_set.headers.id
  order                     = 1
  behavior_on_match         = "Continue"

  actions {
    response_header_action {
      header_action = "Overwrite"
      header_name   = "X-Robots-Tag"
      value         = "noindex, nofollow"
    }
  }
}`
    : '';

  // Private Link block for origins (Premium only)
  const kongPrivateLink = config.frontdoorPremium
    ? `

  private_link {
    request_message        = "Front Door Private Link"
    target_type            = "sites"
    location               = azurerm_linux_web_app.kong.location
    private_link_target_id = azurerm_linux_web_app.kong.id
  }`
    : '';

  // API origin (Kong App Service)
  const apiOriginHostname = `\${azurerm_linux_web_app.kong.default_hostname}`;

  // Next.js origins + routes (per service)
  const nextjsOriginsAndRoutes = nextjsEntries
    .map(([name]) => {
      const tfId = toTerraformId(name);
      const hostname = `\${azurerm_linux_web_app.nextjs_${tfId}.default_hostname}`;
      const privateLink = config.frontdoorPremium
        ? `

  private_link {
    request_message        = "Front Door Private Link"
    target_type            = "sites"
    location               = azurerm_linux_web_app.nextjs_${tfId}.location
    private_link_target_id = azurerm_linux_web_app.nextjs_${tfId}.id
  }`
        : '';

      return `
resource "azurerm_cdn_frontdoor_origin" "nextjs_${tfId}" {
  name                           = "\${var.project_name}-\${var.environment}-${name}-origin"
  cdn_frontdoor_origin_group_id  = azurerm_cdn_frontdoor_origin_group.nextjs_${tfId}.id
  enabled                        = true
  host_name                      = "${hostname}"
  http_port                      = 80
  https_port                     = 443
  origin_host_header             = "${hostname}"
  certificate_name_check_enabled = true${privateLink}
}

resource "azurerm_cdn_frontdoor_route" "nextjs_${tfId}" {
  name                          = "\${var.project_name}-\${var.environment}-${name}-route"
  cdn_frontdoor_endpoint_id     = azurerm_cdn_frontdoor_endpoint.nextjs_${tfId}.id
  cdn_frontdoor_origin_group_id = azurerm_cdn_frontdoor_origin_group.nextjs_${tfId}.id
  cdn_frontdoor_origin_ids      = [azurerm_cdn_frontdoor_origin.nextjs_${tfId}.id]
  supported_protocols           = ["Http", "Https"]
  patterns_to_match             = ["/*"]
  forwarding_protocol           = "HttpsOnly"
  https_redirect_enabled        = true
  link_to_default_domain        = true${config.baseDomain && !config.skipCustomDomainAssociations ? `\n  cdn_frontdoor_custom_domain_ids = [azurerm_cdn_frontdoor_custom_domain.nextjs_${tfId}.id]` : ''}${ruleSetIds}
}`;
    })
    .join('\n');

  // SPA origins + routes
  const spaOriginsAndRoutes = spaEntries
    .map(
      ([name]) => `
resource "azurerm_cdn_frontdoor_origin" "spa_${toTerraformId(name)}" {
  name                           = "\${var.project_name}-\${var.environment}-${name}-origin"
  cdn_frontdoor_origin_group_id  = azurerm_cdn_frontdoor_origin_group.spa_${toTerraformId(name)}.id
  enabled                        = true
  host_name                      = azurerm_storage_account.spa_${toTerraformId(name)}.primary_web_host
  http_port                      = 80
  https_port                     = 443
  origin_host_header             = azurerm_storage_account.spa_${toTerraformId(name)}.primary_web_host
  certificate_name_check_enabled = true
}

resource "azurerm_cdn_frontdoor_route" "spa_${toTerraformId(name)}" {
  name                          = "\${var.project_name}-\${var.environment}-${name}-route"
  cdn_frontdoor_endpoint_id     = azurerm_cdn_frontdoor_endpoint.spa_${toTerraformId(name)}.id
  cdn_frontdoor_origin_group_id = azurerm_cdn_frontdoor_origin_group.spa_${toTerraformId(name)}.id
  cdn_frontdoor_origin_ids      = [azurerm_cdn_frontdoor_origin.spa_${toTerraformId(name)}.id]
  supported_protocols           = ["Http", "Https"]
  patterns_to_match             = ["/*"]
  forwarding_protocol           = "HttpsOnly"
  https_redirect_enabled        = true
  link_to_default_domain        = true${config.baseDomain && !config.skipCustomDomainAssociations ? `\n  cdn_frontdoor_custom_domain_ids = [azurerm_cdn_frontdoor_custom_domain.spa_${toTerraformId(name)}.id]` : ''}${ruleSetIds}
}`,
    )
    .join('\n');

  return `# Azure Front Door
# Generated by: npx tsdevstack infra:generate

# =============================================================================
# Front Door Profile (${config.frontdoorPremium ? 'Premium' : 'Standard'} Tier)
# =============================================================================

resource "azurerm_cdn_frontdoor_profile" "main" {
  name                = "\${var.project_name}-\${var.environment}-frontdoor"
  resource_group_name = data.azurerm_resource_group.main.name
  sku_name            = "${config.frontdoorPremium ? 'Premium_AzureFrontDoor' : 'Standard_AzureFrontDoor'}"
  tags                = local.tags
}

# =============================================================================
# Security Policy (links WAF to Front Door — WAF policy defined in waf.tf)
# =============================================================================

resource "azurerm_cdn_frontdoor_security_policy" "main" {
  name                     = "\${var.project_name}-\${var.environment}-security"
  cdn_frontdoor_profile_id = azurerm_cdn_frontdoor_profile.main.id

  security_policies {
    firewall {
      cdn_frontdoor_firewall_policy_id = azurerm_cdn_frontdoor_firewall_policy.main.id

      association {
        patterns_to_match = ["/*"]

        domain {
          cdn_frontdoor_domain_id = azurerm_cdn_frontdoor_endpoint.api.id
        }
${nextjsSecurityDomains}${spaSecurityDomains}
${customDomainSecurityDomains}
      }
    }
  }
}

# =============================================================================
# Endpoints
# =============================================================================

resource "azurerm_cdn_frontdoor_endpoint" "api" {
  name                     = "\${var.project_name}-\${var.environment}-api"
  cdn_frontdoor_profile_id = azurerm_cdn_frontdoor_profile.main.id
  tags                     = local.tags
}
${nextjsEndpoints}${spaEndpoints}

# =============================================================================
# Origin Groups
# =============================================================================

resource "azurerm_cdn_frontdoor_origin_group" "api" {
  name                     = "\${var.project_name}-\${var.environment}-api-origin"
  cdn_frontdoor_profile_id = azurerm_cdn_frontdoor_profile.main.id
  session_affinity_enabled = false

  load_balancing {
    sample_size                 = 4
    successful_samples_required = 3
  }

  health_probe {
    path                = "/status"
    protocol            = "Https"
    interval_in_seconds = 30
    request_type        = "HEAD"
  }
}
${nextjsOriginGroups}${spaOriginGroups}

# =============================================================================
# Origins
# =============================================================================

resource "azurerm_cdn_frontdoor_origin" "api" {
  name                           = "\${var.project_name}-\${var.environment}-api-origin"
  cdn_frontdoor_origin_group_id  = azurerm_cdn_frontdoor_origin_group.api.id
  enabled                        = true
  host_name                      = "${apiOriginHostname}"
  http_port                      = 80
  https_port                     = 443
  origin_host_header             = "${apiOriginHostname}"
  certificate_name_check_enabled = true${kongPrivateLink}
}
${nextjsOriginsAndRoutes}
${spaOriginsAndRoutes}

# =============================================================================
# Routes
# =============================================================================

resource "azurerm_cdn_frontdoor_route" "api" {
  name                          = "\${var.project_name}-\${var.environment}-api-route"
  cdn_frontdoor_endpoint_id     = azurerm_cdn_frontdoor_endpoint.api.id
  cdn_frontdoor_origin_group_id = azurerm_cdn_frontdoor_origin_group.api.id
  cdn_frontdoor_origin_ids      = [azurerm_cdn_frontdoor_origin.api.id]
  supported_protocols           = ["Http", "Https"]
  patterns_to_match             = ["/*"]
  forwarding_protocol           = "HttpsOnly"
  https_redirect_enabled        = true
  link_to_default_domain        = true${config.baseDomain && !config.skipCustomDomainAssociations ? `\n  cdn_frontdoor_custom_domain_ids = [azurerm_cdn_frontdoor_custom_domain.api.id]` : ''}${ruleSetIds}
}
${noIndexRuleSet}
`;
}
