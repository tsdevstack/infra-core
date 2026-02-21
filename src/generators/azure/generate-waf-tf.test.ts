import { describe, it, expect } from '@rstest/core';
import { generateWafTf } from './generate-waf-tf';
import type { AzureInfraConfig } from '../../types/config.ts';

function makeConfig(
  overrides: Partial<AzureInfraConfig> = {},
): AzureInfraConfig {
  return {
    provider: 'azure',
    projectName: 'testproject',
    environment: 'dev',
    subscriptionId: 'sub-123',
    location: 'eastus2',
    storageAccountName: 'testprojectdevtfstate',
    database: {
      tier: 'B_Standard_B1ms',
      storageSizeGb: 32,
      deletionProtection: false,
      backup: false,
    },
    redis: { tier: 'Balanced_B0' },
    servicesWithDatabase: [],
    baseDomain: '',
    services: {},
    workers: {},
    allDeployables: {},
    spas: {},
    frontends: {},
    scheduledJobs: {},
    noIndex: false,
    frontdoorPremium: false,
    kongAppServiceSku: 'B1',
    nextjsAppServiceSku: 'B1',
    ...overrides,
  };
}

describe('generateWafTf', () => {
  describe('WAF Policy Resource', () => {
    it('should create firewall policy resource', () => {
      const result = generateWafTf(makeConfig());
      expect(result).toContain(
        'resource "azurerm_cdn_frontdoor_firewall_policy" "main"',
      );
    });

    it('should strip hyphens from policy name', () => {
      const result = generateWafTf(makeConfig());
      expect(result).toContain('replace(var.project_name, "-", "")');
    });

    it('should reference profile SKU', () => {
      const result = generateWafTf(makeConfig());
      expect(result).toContain(
        'sku_name                          = azurerm_cdn_frontdoor_profile.main.sku_name',
      );
    });

    it('should set mode to Prevention', () => {
      const result = generateWafTf(makeConfig());
      expect(result).toContain(
        'mode                              = "Prevention"',
      );
    });

    it('should be enabled', () => {
      const result = generateWafTf(makeConfig());
      expect(result).toContain('enabled                           = true');
    });

    it('should apply tags', () => {
      const result = generateWafTf(makeConfig());
      expect(result).toContain(
        'tags                              = local.tags',
      );
    });
  });

  describe('Standard tier (default)', () => {
    it('should include custom rule blocks', () => {
      const result = generateWafTf(makeConfig());
      expect(result).toContain('custom_rule {');
    });

    it('should include RateLimitGlobal rule', () => {
      const result = generateWafTf(makeConfig());
      expect(result).toContain('name     = "RateLimitGlobal"');
    });

    it('should include SQL injection rules (band 500-599)', () => {
      const result = generateWafTf(makeConfig());
      expect(result).toContain('name     = "BlockSQLiKeywordsUri"');
    });

    it('should include XSS rules (band 600-699)', () => {
      const result = generateWafTf(makeConfig());
      expect(result).toContain('name     = "BlockXSSScriptTagsUri"');
    });

    it('should include path traversal rules (band 700-799)', () => {
      const result = generateWafTf(makeConfig());
      expect(result).toContain('name     = "BlockPathTraversalUri"');
    });

    it('should not include managed_rule blocks', () => {
      const result = generateWafTf(makeConfig());
      expect(result).not.toContain('managed_rule {');
    });

    it('should note Standard tier in header', () => {
      const result = generateWafTf(makeConfig());
      expect(result).toContain('Standard tier');
    });
  });

  describe('Premium tier', () => {
    it('should include managed_rule for DRS 2.1', () => {
      const result = generateWafTf(makeConfig({ frontdoorPremium: true }));
      expect(result).toContain('managed_rule {');
      expect(result).toContain('type    = "Microsoft_DefaultRuleSet"');
      expect(result).toContain('version = "2.1"');
    });

    it('should include managed_rule for Bot Manager', () => {
      const result = generateWafTf(makeConfig({ frontdoorPremium: true }));
      expect(result).toContain('type    = "Microsoft_BotManagerRuleSet"');
      expect(result).toContain('version = "1.1"');
    });

    it('should set action to Block on managed rules', () => {
      const result = generateWafTf(makeConfig({ frontdoorPremium: true }));
      expect(result).toContain('action  = "Block"');
    });

    it('should exclude SQL injection rules (band 500-599)', () => {
      const result = generateWafTf(makeConfig({ frontdoorPremium: true }));
      expect(result).not.toContain('name     = "BlockSQLiKeywordsUri"');
    });

    it('should exclude XSS rules (band 600-699)', () => {
      const result = generateWafTf(makeConfig({ frontdoorPremium: true }));
      expect(result).not.toContain('name     = "BlockXSSScriptTagsUri"');
    });

    it('should exclude path traversal rules (band 700-799)', () => {
      const result = generateWafTf(makeConfig({ frontdoorPremium: true }));
      expect(result).not.toContain('name     = "BlockPathTraversalUri"');
    });

    it('should still include rate limiting rules', () => {
      const result = generateWafTf(makeConfig({ frontdoorPremium: true }));
      expect(result).toContain('name     = "RateLimitGlobal"');
    });

    it('should note Premium tier in header', () => {
      const result = generateWafTf(makeConfig({ frontdoorPremium: true }));
      expect(result).toContain('Premium tier');
    });
  });

  describe('header comment', () => {
    it('should include generation comment', () => {
      const result = generateWafTf(makeConfig());
      expect(result).toContain('Generated by: npx tsdevstack infra:generate');
    });
  });
});
