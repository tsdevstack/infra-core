import { describe, it, expect } from '@rstest/core';
import { generateWafCustomRules } from './generate-waf-custom-rules';

describe('generateWafCustomRules', () => {
  describe('Rate Limiting (100-149)', () => {
    it('should include global rate limit at 1000/min', () => {
      const result = generateWafCustomRules();
      expect(result).toContain('name     = "RateLimitGlobal"');
      expect(result).toContain('type     = "RateLimitRule"');
      expect(result).toContain('priority = 100');
      expect(result).toContain('rate_limit_threshold           = 1000');
      expect(result).toContain('rate_limit_duration_in_minutes = 1');
    });

    it('should match all IPs for global rate limit', () => {
      const result = generateWafCustomRules();
      expect(result).toContain('"0.0.0.0/0"');
      expect(result).toContain('"::/0"');
    });

    it('should include auth endpoint rate limit at 50/min', () => {
      const result = generateWafCustomRules();
      expect(result).toContain('name     = "RateLimitAuth"');
      expect(result).toContain('rate_limit_threshold           = 50');
      expect(result).toContain('"/login"');
      expect(result).toContain('"/oauth"');
    });

    it('should include API, GraphQL, and webhook rate limits', () => {
      const result = generateWafCustomRules();
      expect(result).toContain('name     = "RateLimitAPI"');
      expect(result).toContain('name     = "RateLimitGraphQL"');
      expect(result).toContain('name     = "RateLimitWebhooks"');
    });
  });

  describe('Size Restrictions (150-199)', () => {
    it('should block oversized query strings with GreaterThan operator', () => {
      const result = generateWafCustomRules();
      expect(result).toContain('name     = "BlockOversizedQueryString"');
      expect(result).toContain('match_variable = "QueryString"');
      expect(result).toContain('operator       = "GreaterThan"');
      expect(result).toContain('"4096"');
    });

    it('should block oversized cookies', () => {
      const result = generateWafCustomRules();
      expect(result).toContain('name     = "BlockOversizedCookies"');
      expect(result).toContain('"10240"');
    });

    it('should block oversized URIs and headers', () => {
      const result = generateWafCustomRules();
      expect(result).toContain('name     = "BlockOversizedURI"');
      expect(result).toContain('name     = "BlockOversizedHeaders"');
    });
  });

  describe('Methods, Protocols & Restricted Paths (200-299)', () => {
    it('should block WebDAV and debug methods', () => {
      const result = generateWafCustomRules();
      expect(result).toContain('name     = "BlockDangerousMethods"');
      expect(result).toContain('"TRACE"');
      expect(result).toContain('"CONNECT"');
      expect(result).toContain('"PROPFIND"');
      expect(result).toContain('"LOCK"');
    });

    it('should block WordPress/CMS scanner paths', () => {
      const result = generateWafCustomRules();
      expect(result).toContain('name     = "BlockRestrictedPaths"');
      expect(result).toContain('"/admin"');
      expect(result).toContain('"/wp-admin"');
      expect(result).toContain('"/cgi-bin"');
      expect(result).toContain('"/xmlrpc.php"');
    });

    it('should block hidden files including expanded list', () => {
      const result = generateWafCustomRules();
      expect(result).toContain('name     = "BlockHiddenFiles"');
      expect(result).toContain('"/.env"');
      expect(result).toContain('"/.git"');
      expect(result).toContain('"/.config"');
      expect(result).toContain('"/.npmrc"');
    });

    it('should block HTTP smuggling headers', () => {
      const result = generateWafCustomRules();
      expect(result).toContain('name     = "BlockHTTPSmugglingHeaders"');
      expect(result).toContain('selector       = "Transfer-Encoding"');
      expect(result).toContain('"chunked,"');
    });

    it('should block server-side script extensions', () => {
      const result = generateWafCustomRules();
      expect(result).toContain('name     = "BlockRestrictedUploads"');
      expect(result).toContain('".php"');
      expect(result).toContain('".exe"');
    });

    it('should block backup, sensitive, and package files', () => {
      const result = generateWafCustomRules();
      expect(result).toContain('name     = "BlockBackupFiles"');
      expect(result).toContain('name     = "BlockSensitiveFiles"');
      expect(result).toContain('name     = "BlockPackageFiles"');
      expect(result).toContain('".tfstate"');
      expect(result).toContain('"dockerfile"');
    });
  });

  describe('Scanner Fingerprints (300-399)', () => {
    it('should block known scanner user agents', () => {
      const result = generateWafCustomRules();
      expect(result).toContain('name     = "BlockKnownScanners"');
      expect(result).toContain('"nikto"');
      expect(result).toContain('"sqlmap"');
      expect(result).toContain('"burpsuite"');
    });

    it('should block additional scanners including owasp-zap', () => {
      const result = generateWafCustomRules();
      expect(result).toContain('name     = "BlockMoreScanners"');
      expect(result).toContain('"owasp-zap"');
      expect(result).toContain('"nuclei"');
      expect(result).toContain('"whatweb"');
    });
  });

  describe('Known CVE Patterns (400-499)', () => {
    it('should block Log4Shell with HCL-escaped ${jndi:', () => {
      const result = generateWafCustomRules();
      expect(result).toContain('name     = "BlockLog4ShellUri"');
      expect(result).toContain('$${jndi:');
      expect(result).toContain('$${jndi:ldap');
    });

    it('should block Log4Shell in headers and body', () => {
      const result = generateWafCustomRules();
      expect(result).toContain('name     = "BlockLog4ShellHeaders"');
      expect(result).toContain('name     = "BlockLog4ShellBody"');
    });

    it('should block Spring4Shell in URI and body', () => {
      const result = generateWafCustomRules();
      expect(result).toContain('name     = "BlockSpringShellUri"');
      expect(result).toContain('name     = "BlockSpringShellBody"');
      expect(result).toContain('"class.module.classloader"');
      expect(result).toContain('"spring.cloud.function"');
    });

    it('should block Shellshock with no transforms', () => {
      const result = generateWafCustomRules();
      const shellshockBlock = result.slice(
        result.indexOf('name     = "BlockShellshock"'),
        result.indexOf('name     = "BlockSQLiKeywordsUri"'),
      );
      expect(shellshockBlock).toContain('"() { :;};"');
      expect(shellshockBlock).toContain('"() { :; };"');
      expect(shellshockBlock).not.toContain('transforms');
    });
  });

  describe('SQL Injection (500-599)', () => {
    it('should block SQL keywords in URI and body', () => {
      const result = generateWafCustomRules();
      expect(result).toContain('name     = "BlockSQLiKeywordsUri"');
      expect(result).toContain('name     = "BlockSQLiKeywordsBody"');
      expect(result).toContain('"union select"');
      expect(result).toContain('"truncate table"');
    });

    it('should block SQL stored procedures', () => {
      const result = generateWafCustomRules();
      expect(result).toContain('name     = "BlockSQLiFunctionsUri"');
      expect(result).toContain('name     = "BlockSQLiFunctionsBody"');
      expect(result).toContain('"xp_cmdshell"');
    });

    it('should block blind SQLi timing attacks', () => {
      const result = generateWafCustomRules();
      expect(result).toContain('name     = "BlockSQLiTimingUri"');
      expect(result).toContain('"sleep("');
      expect(result).toContain('"pg_sleep("');
    });

    it('should block SQL auth bypass patterns with escaped quotes', () => {
      const result = generateWafCustomRules();
      expect(result).toContain('name     = "BlockSQLiAuthBypassUri"');
      expect(result).toContain('name     = "BlockSQLiAuthBypassBody"');
      // " or " contains double quotes that get HCL-escaped
      expect(result).toContain('\\" or \\"');
    });

    it('should block SQL meta-table access', () => {
      const result = generateWafCustomRules();
      expect(result).toContain('name     = "BlockSQLiMetaTablesUri"');
      expect(result).toContain('"information_schema"');
      expect(result).toContain('"sqlite_master"');
    });

    it('should block SQL comment injection', () => {
      const result = generateWafCustomRules();
      expect(result).toContain('name     = "BlockSQLiCommentsUri"');
      expect(result).toContain('"/**/"');
    });

    it('should block SQLi via Cookie header', () => {
      const result = generateWafCustomRules();
      expect(result).toContain('name     = "BlockSQLiCookieHeader"');
      expect(result).toContain('selector       = "Cookie"');
    });
  });

  describe('XSS (600-699)', () => {
    it('should block HTML injection tags in URI and body', () => {
      const result = generateWafCustomRules();
      expect(result).toContain('name     = "BlockXSSScriptTagsUri"');
      expect(result).toContain('name     = "BlockXSSScriptTagsBody"');
      expect(result).toContain('"<script"');
      expect(result).toContain('"<svg"');
    });

    it('should block XXE in body with Lowercase only', () => {
      const result = generateWafCustomRules();
      const xxeBlock = result.slice(
        result.indexOf('name     = "BlockXXEBody"'),
        result.indexOf('name     = "BlockXSSProtocolsUri"'),
      );
      expect(xxeBlock).toContain('"<!entity"');
      expect(xxeBlock).toContain('transforms     = ["Lowercase"]');
      expect(xxeBlock).not.toContain('"UrlDecode"');
    });

    it('should block XSS protocol handlers', () => {
      const result = generateWafCustomRules();
      expect(result).toContain('name     = "BlockXSSProtocolsUri"');
      expect(result).toContain('"javascript:"');
      expect(result).toContain('"data:text/html"');
    });

    it('should split event handlers into two URI batches plus body', () => {
      const result = generateWafCustomRules();
      expect(result).toContain('name     = "BlockXSSEventHandlersUri1"');
      expect(result).toContain('name     = "BlockXSSEventHandlersUri2"');
      expect(result).toContain('name     = "BlockXSSEventHandlersBody"');
      expect(result).toContain('"onkeypress="');
      expect(result).toContain('"onscroll="');
    });

    it('should block DOM manipulation methods', () => {
      const result = generateWafCustomRules();
      expect(result).toContain('name     = "BlockXSSDOMMethodsUri"');
      expect(result).toContain('"document.cookie"');
      expect(result).toContain('"string.fromcharcode"');
    });
  });

  describe('Path Traversal, LFI, RFI & SSRF (700-799)', () => {
    it('should block path traversal with encoding variants', () => {
      const result = generateWafCustomRules();
      expect(result).toContain('name     = "BlockPathTraversalUri"');
      expect(result).toContain('"../"');
      // ..\ gets HCL-escaped to ..\\
      expect(result).toContain('"..\\\\"');
      expect(result).toContain('"..%2f"');
      expect(result).toContain('"..;/"');
    });

    it('should use UrlDecode only for path traversal (no Lowercase)', () => {
      const result = generateWafCustomRules();
      const traversalBlock = result.slice(
        result.indexOf('name     = "BlockPathTraversalUri"'),
        result.indexOf('name     = "BlockOSFileAccessUri"'),
      );
      expect(traversalBlock).toContain('transforms     = ["UrlDecode"]');
      expect(traversalBlock).not.toContain('"Lowercase"');
    });

    it('should block Unix OS file access', () => {
      const result = generateWafCustomRules();
      expect(result).toContain('name     = "BlockOSFileAccessUri"');
      expect(result).toContain('"/etc/passwd"');
      expect(result).toContain('"/proc/self"');
    });

    it('should block cloud credential file access', () => {
      const result = generateWafCustomRules();
      expect(result).toContain('name     = "BlockSensitiveDirAccessUri"');
      expect(result).toContain('".aws/credentials"');
      expect(result).toContain('".kube/config"');
    });

    it('should block SSRF metadata endpoints including Azure', () => {
      const result = generateWafCustomRules();
      expect(result).toContain('name     = "BlockSSRFMetadataUri"');
      expect(result).toContain('"169.254.169.254"');
      expect(result).toContain('"metadata.azure.com"');
    });

    it('should block SSRF localhost with encoding variants', () => {
      const result = generateWafCustomRules();
      expect(result).toContain('name     = "BlockSSRFLocalhostUri"');
      expect(result).toContain('name     = "BlockSSRFLocalhostBody"');
      expect(result).toContain('"0x7f000001"');
    });

    it('should block RFI protocols scoped to parameters in URI', () => {
      const result = generateWafCustomRules();
      expect(result).toContain('name     = "BlockRFIProtocolsUri"');
      expect(result).toContain('"=http://"');
      expect(result).toContain('"=file://"');
    });

    it('should block dangerous RFI protocols in body without http/https', () => {
      const result = generateWafCustomRules();
      const rfiBodyBlock = result.slice(
        result.indexOf('name     = "BlockRFIProtocolsBody"'),
        result.indexOf('name     = "BlockRestrictedExtensions"'),
      );
      expect(rfiBodyBlock).toContain('"file://"');
      expect(rfiBodyBlock).toContain('"gopher://"');
      expect(rfiBodyBlock).not.toContain('"http://"');
      expect(rfiBodyBlock).not.toContain('"https://"');
    });

    it('should block path traversal in body', () => {
      const result = generateWafCustomRules();
      expect(result).toContain('name     = "BlockPathTraversalBody"');
    });
  });

  describe('Node.js / App-Specific (800-849)', () => {
    it('should block prototype pollution with extended patterns', () => {
      const result = generateWafCustomRules();
      expect(result).toContain('name     = "BlockProtoPollutionUri"');
      expect(result).toContain('"__proto__"');
      expect(result).toContain('"constructor["');
      expect(result).toContain('".__proto__["');
    });

    it('should block Node.js code injection with escaped require("child', () => {
      const result = generateWafCustomRules();
      expect(result).toContain('name     = "BlockNodeCodeInjectionUri"');
      expect(result).toContain('"child_process"');
      // require("child gets HCL-escaped: the " becomes \"
      expect(result).toContain('require(\\"child');
      expect(result).toContain('"process.env"');
    });

    it('should block SSTI with HCL-escaped ${7*7}', () => {
      const result = generateWafCustomRules();
      expect(result).toContain('name     = "BlockNodeTemplateInjectionUri"');
      expect(result).toContain('name     = "BlockNodeTemplateInjectionBody"');
      expect(result).toContain('$${7*7}');
      expect(result).toContain('"{{7*7}}"');
      expect(result).toContain('$${constructor');
    });
  });

  describe('Command Injection / RCE (850-899)', () => {
    it('should block shell metacharacters with commands', () => {
      const result = generateWafCustomRules();
      expect(result).toContain('name     = "BlockOSCommandMetacharsUri"');
      expect(result).toContain('name     = "BlockOSCommandMetacharsBody"');
      expect(result).toContain('"| cat"');
      expect(result).toContain('"$(wget"');
    });

    it('should block backtick command execution', () => {
      const result = generateWafCustomRules();
      expect(result).toContain('name     = "BlockOSCommandNamesUri"');
      expect(result).toContain('"`whoami`"');
      expect(result).toContain('"`id`"');
    });

    it('should block shell interpreter paths', () => {
      const result = generateWafCustomRules();
      expect(result).toContain('name     = "BlockShellKeywordsUri"');
      expect(result).toContain('name     = "BlockShellKeywordsBody"');
      expect(result).toContain('"/bin/bash"');
      expect(result).toContain('"bash -c"');
    });
  });

  describe('Protocol Attacks (900-949)', () => {
    it('should block response splitting with Lowercase only (no UrlDecode)', () => {
      const result = generateWafCustomRules();
      const splittingBlock = result.slice(
        result.indexOf('name     = "BlockResponseSplittingUri"'),
        result.indexOf('name     = "BlockLDAPInjectionUri"'),
      );
      expect(splittingBlock).toContain('"%0d%0a"');
      expect(splittingBlock).toContain('"%0d%0aset-cookie"');
      expect(splittingBlock).toContain('transforms     = ["Lowercase"]');
      expect(splittingBlock).not.toContain('"UrlDecode"');
    });

    it('should block LDAP injection patterns', () => {
      const result = generateWafCustomRules();
      expect(result).toContain('name     = "BlockLDAPInjectionUri"');
      expect(result).toContain('")(cn="');
      expect(result).toContain('")(|("');
    });

    it('should block request smuggling in body', () => {
      const result = generateWafCustomRules();
      expect(result).toContain('name     = "BlockRequestSmugglingBody"');
      expect(result).toContain('"transfer-encoding:"');
    });

    it('should block host header poisoning', () => {
      const result = generateWafCustomRules();
      expect(result).toContain('name     = "BlockHostHeaderAttack"');
      expect(result).toContain('selector       = "Host"');
      expect(result).toContain('"169.254.169.254"');
    });
  });

  describe('Miscellaneous (950-999)', () => {
    it('should block web shell function calls and known shells', () => {
      const result = generateWafCustomRules();
      expect(result).toContain('name     = "BlockWebShellPatternsUri"');
      expect(result).toContain('name     = "BlockWebShellPatternsBody"');
      expect(result).toContain('"system("');
      expect(result).toContain('"c99shell"');
    });

    it('should block encoding evasion attempts', () => {
      const result = generateWafCustomRules();
      expect(result).toContain('name     = "BlockEncodedPayloadsUri"');
      expect(result).toContain('"base64_decode"');
      expect(result).toContain('"unescape("');
    });

    it('should block SQLi/XSS via Referer header', () => {
      const result = generateWafCustomRules();
      expect(result).toContain('name     = "BlockSQLiHeaderReferer"');
      expect(result).toContain('selector       = "Referer"');
    });

    it('should block XSS via Cookie header', () => {
      const result = generateWafCustomRules();
      expect(result).toContain('name     = "BlockXSSCookieHeader"');
    });
  });

  describe('HCL structure', () => {
    it('should generate exactly 79 custom_rule blocks', () => {
      const result = generateWafCustomRules();
      const count = (result.match(/custom_rule \{/g) ?? []).length;
      expect(count).toBe(79);
    });

    it('should have unique priorities for all rules', () => {
      const result = generateWafCustomRules();
      const priorities: string[] = [];
      let match: RegExpExecArray | null;
      const priorityRegex = /priority = (\d+)/g;
      while ((match = priorityRegex.exec(result)) !== null) {
        priorities.push(match[1]);
      }
      const uniquePriorities = new Set(priorities);
      expect(priorities.length).toBe(79);
      expect(uniquePriorities.size).toBe(79);
    });

    it('should have unique names for all rules', () => {
      const result = generateWafCustomRules();
      const names: string[] = [];
      let match: RegExpExecArray | null;
      const nameRegex = /name\s+= "([^"]+)"/g;
      while ((match = nameRegex.exec(result)) !== null) {
        names.push(match[1]);
      }
      const uniqueNames = new Set(names);
      expect(names.length).toBe(79);
      expect(uniqueNames.size).toBe(79);
    });

    it('should have alphanumeric names only (Azure WAF requirement)', () => {
      const result = generateWafCustomRules();
      const names: string[] = [];
      let match: RegExpExecArray | null;
      const nameRegex = /name\s+= "([^"]+)"/g;
      while ((match = nameRegex.exec(result)) !== null) {
        names.push(match[1]);
      }
      for (const name of names) {
        expect(name).toMatch(/^[A-Za-z0-9]+$/);
      }
    });

    it('should use Block action for all rules', () => {
      const result = generateWafCustomRules();
      const actionLines = result
        .split('\n')
        .filter((line) => line.includes('action   ='));
      expect(actionLines.length).toBe(79);
      for (const line of actionLines) {
        expect(line).toContain('"Block"');
      }
    });

    it('should have 5 RateLimitRule and 74 MatchRule', () => {
      const result = generateWafCustomRules();
      const rateLimitCount = (result.match(/type\s+= "RateLimitRule"/g) ?? [])
        .length;
      const matchRuleCount = (result.match(/type\s+= "MatchRule"/g) ?? [])
        .length;
      expect(rateLimitCount).toBe(5);
      expect(matchRuleCount).toBe(74);
    });

    it('should include transforms for standard string matching rules', () => {
      const result = generateWafCustomRules();
      expect(result).toContain('transforms     = ["Lowercase", "UrlDecode"]');
    });

    it('should not include transforms for size restriction rules', () => {
      const result = generateWafCustomRules();
      const sizeBlock = result.slice(
        result.indexOf('name     = "BlockOversizedQueryString"'),
        result.indexOf('name     = "BlockDangerousMethods"'),
      );
      expect(sizeBlock).not.toContain('transforms');
    });

    it('should not include transforms for request method rule', () => {
      const result = generateWafCustomRules();
      const methodBlock = result.slice(
        result.indexOf('name     = "BlockDangerousMethods"'),
        result.indexOf('name     = "BlockRestrictedPaths"'),
      );
      expect(methodBlock).not.toContain('transforms');
    });

    it('should include selector for header-based rules', () => {
      const result = generateWafCustomRules();
      expect(result).toContain('selector       = "User-Agent"');
      expect(result).toContain('selector       = "Cookie"');
      expect(result).toContain('selector       = "Transfer-Encoding"');
      expect(result).toContain('selector       = "Referer"');
      expect(result).toContain('selector       = "Host"');
    });

    it('should include rate limit fields only for RateLimitRule', () => {
      const result = generateWafCustomRules();
      const rateLimitOccurrences = (result.match(/rate_limit_threshold/g) ?? [])
        .length;
      expect(rateLimitOccurrences).toBe(5);
    });
  });

  describe('skipManagedBands (Premium tier)', () => {
    it('should return 35 custom rules when skipManagedBands is true', () => {
      const result = generateWafCustomRules({ skipManagedBands: true });
      const ruleCount = (result.match(/custom_rule \{/g) ?? []).length;
      expect(ruleCount).toBe(35);
    });

    it('should return 79 custom rules when skipManagedBands is false', () => {
      const result = generateWafCustomRules({ skipManagedBands: false });
      const ruleCount = (result.match(/custom_rule \{/g) ?? []).length;
      expect(ruleCount).toBe(79);
    });

    it('should return 79 custom rules when no options provided', () => {
      const result = generateWafCustomRules();
      const ruleCount = (result.match(/custom_rule \{/g) ?? []).length;
      expect(ruleCount).toBe(79);
    });

    it('should exclude SQL injection rules (500-599) when skipping', () => {
      const result = generateWafCustomRules({ skipManagedBands: true });
      expect(result).not.toContain('name     = "BlockSQLiKeywordsUri"');
      expect(result).not.toContain('priority = 500');
    });

    it('should exclude XSS rules (600-699) when skipping', () => {
      const result = generateWafCustomRules({ skipManagedBands: true });
      expect(result).not.toContain('name     = "BlockXSSScriptTagsUri"');
      expect(result).not.toContain('priority = 600');
    });

    it('should exclude path traversal rules (700-799) when skipping', () => {
      const result = generateWafCustomRules({ skipManagedBands: true });
      expect(result).not.toContain('name     = "BlockPathTraversalUri"');
      expect(result).not.toContain('priority = 700');
    });

    it('should exclude Node.js rules (800-849) when skipping', () => {
      const result = generateWafCustomRules({ skipManagedBands: true });
      expect(result).not.toContain('priority = 800');
    });

    it('should exclude command injection rules (850-899) when skipping', () => {
      const result = generateWafCustomRules({ skipManagedBands: true });
      expect(result).not.toContain('priority = 850');
    });

    it('should keep rate limiting rules (100-149) when skipping', () => {
      const result = generateWafCustomRules({ skipManagedBands: true });
      expect(result).toContain('name     = "RateLimitGlobal"');
      expect(result).toContain('priority = 100');
    });

    it('should keep scanner fingerprint rules (300-399) when skipping', () => {
      const result = generateWafCustomRules({ skipManagedBands: true });
      expect(result).toContain('priority = 300');
    });

    it('should keep CVE pattern rules (400-499) when skipping', () => {
      const result = generateWafCustomRules({ skipManagedBands: true });
      expect(result).toContain('priority = 400');
    });

    it('should keep protocol attack rules (900-949) when skipping', () => {
      const result = generateWafCustomRules({ skipManagedBands: true });
      expect(result).toContain('priority = 900');
    });
  });
});
