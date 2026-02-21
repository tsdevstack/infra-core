import { describe, it, expect } from '@rstest/core';
import { generateWafTf } from './generate-waf-tf';

describe('generateWafTf', () => {
  describe('Web ACL', () => {
    it('should create WAF Web ACL', () => {
      const result = generateWafTf();
      expect(result).toContain('resource "aws_wafv2_web_acl" "main"');
    });

    it('should use us-east-1 provider', () => {
      const result = generateWafTf();
      expect(result).toContain('provider = aws.us_east_1');
    });

    it('should use CLOUDFRONT scope', () => {
      const result = generateWafTf();
      expect(result).toContain('scope    = "CLOUDFRONT"');
    });

    it('should default to allow', () => {
      const result = generateWafTf();
      expect(result).toContain('default_action {');
      expect(result).toContain('allow {}');
    });
  });

  describe('OWASP Common Rules', () => {
    it('should include Common Rule Set', () => {
      const result = generateWafTf();
      expect(result).toContain('name        = "AWSManagedRulesCommonRuleSet"');
    });

    it('should have priority 1', () => {
      const result = generateWafTf();
      expect(result).toContain('name     = "AWSManagedRulesCommonRuleSet"');
      expect(result).toContain('priority = 1');
    });
  });

  describe('SQL Injection Rules', () => {
    it('should include SQLi Rule Set', () => {
      const result = generateWafTf();
      expect(result).toContain('name        = "AWSManagedRulesSQLiRuleSet"');
    });

    it('should have priority 2', () => {
      const result = generateWafTf();
      expect(result).toContain('name     = "AWSManagedRulesSQLiRuleSet"');
    });
  });

  describe('Known Bad Inputs Rules', () => {
    it('should include Known Bad Inputs Rule Set', () => {
      const result = generateWafTf();
      expect(result).toContain(
        'name        = "AWSManagedRulesKnownBadInputsRuleSet"',
      );
    });
  });

  describe('SSRF Protection', () => {
    it('should block metadata endpoint', () => {
      const result = generateWafTf();
      expect(result).toContain('name     = "BlockMetadataEndpoint"');
      expect(result).toContain('search_string         = "169.254.169.254"');
    });

    it('should use URL_DECODE transformation', () => {
      const result = generateWafTf();
      expect(result).toContain('type     = "URL_DECODE"');
    });
  });

  describe('Rate Limiting', () => {
    it('should include rate limit rule', () => {
      const result = generateWafTf();
      expect(result).toContain('name     = "RateLimit"');
    });

    it('should limit to 1000 requests per IP', () => {
      const result = generateWafTf();
      expect(result).toContain('limit              = 1000');
      expect(result).toContain('aggregate_key_type = "IP"');
    });
  });

  describe('IP Reputation List', () => {
    it('should include IP Reputation List', () => {
      const result = generateWafTf();
      expect(result).toContain(
        'name        = "AWSManagedRulesAmazonIpReputationList"',
      );
    });

    it('should have priority 6', () => {
      const result = generateWafTf();
      expect(result).toContain(
        'name     = "AWSManagedRulesAmazonIpReputationList"',
      );
    });
  });

  describe('Anonymous IP List', () => {
    it('should include Anonymous IP List', () => {
      const result = generateWafTf();
      expect(result).toContain(
        'name        = "AWSManagedRulesAnonymousIpList"',
      );
    });

    it('should have priority 7', () => {
      const result = generateWafTf();
      expect(result).toContain('name     = "AWSManagedRulesAnonymousIpList"');
    });
  });

  describe('Linux Protection', () => {
    it('should include Linux Rule Set', () => {
      const result = generateWafTf();
      expect(result).toContain('name        = "AWSManagedRulesLinuxRuleSet"');
    });

    it('should have priority 8', () => {
      const result = generateWafTf();
      expect(result).toContain('name     = "AWSManagedRulesLinuxRuleSet"');
    });
  });

  describe('Node.js Prototype Pollution Protection', () => {
    it('should include prototype pollution rule', () => {
      const result = generateWafTf();
      expect(result).toContain('name     = "NodejsPrototypePollution"');
    });

    it('should have priority 9', () => {
      const result = generateWafTf();
      expect(result).toContain('name     = "NodejsPrototypePollution"');
      expect(result).toContain('priority = 9');
    });

    it('should block __proto__ in URI, query string, and body', () => {
      const result = generateWafTf();
      expect(result).toContain('search_string         = "__proto__"');
    });

    it('should use or_statement to match multiple fields', () => {
      const result = generateWafTf();
      // The or_statement wraps URI, query_string, and body checks
      const protoPollutionSection = result.slice(
        result.indexOf('NodejsPrototypePollution'),
        result.indexOf('NodejsCodeInjection'),
      );
      expect(protoPollutionSection).toContain('or_statement');
      expect(protoPollutionSection).toContain('uri_path {}');
      expect(protoPollutionSection).toContain('query_string {}');
      expect(protoPollutionSection).toContain('body {}');
    });
  });

  describe('Node.js Code Injection Protection', () => {
    it('should include code injection rule', () => {
      const result = generateWafTf();
      expect(result).toContain('name     = "NodejsCodeInjection"');
    });

    it('should have priority 10', () => {
      const result = generateWafTf();
      expect(result).toContain('name     = "NodejsCodeInjection"');
      expect(result).toContain('priority = 10');
    });

    it('should block child_process in URI, query string, and body', () => {
      const result = generateWafTf();
      expect(result).toContain('search_string         = "child_process"');
    });

    it('should use or_statement to match multiple fields', () => {
      const result = generateWafTf();
      const codeInjectionSection = result.slice(
        result.indexOf('NodejsCodeInjection'),
      );
      expect(codeInjectionSection).toContain('or_statement');
      expect(codeInjectionSection).toContain('uri_path {}');
      expect(codeInjectionSection).toContain('query_string {}');
      expect(codeInjectionSection).toContain('body {}');
    });
  });

  describe('visibility config', () => {
    it('should enable sampled requests', () => {
      const result = generateWafTf();
      expect(result).toContain('sampled_requests_enabled   = true');
    });

    it('should enable CloudWatch metrics', () => {
      const result = generateWafTf();
      expect(result).toContain('cloudwatch_metrics_enabled = true');
    });
  });

  describe('outputs', () => {
    it('should output WAF Web ACL ARN', () => {
      const result = generateWafTf();
      expect(result).toContain('output "waf_web_acl_arn"');
      expect(result).toContain('value       = aws_wafv2_web_acl.main.arn');
    });
  });

  describe('header comment', () => {
    it('should include generation comment', () => {
      const result = generateWafTf();
      expect(result).toContain('Generated by: npx tsdevstack infra:generate');
    });
  });

  describe('snapshot', () => {
    it('should match snapshot', () => {
      const result = generateWafTf();
      expect(result).toMatchSnapshot();
    });
  });
});
