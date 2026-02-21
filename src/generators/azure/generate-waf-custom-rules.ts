/**
 * Generate Azure Front Door WAF custom rule blocks
 *
 * Defines 79 security rules for Front Door Standard tier WAF.
 * Standard has no managed rulesets — all protection is custom rules.
 *
 * Priority ranges:
 * - 100-149:  Rate limiting
 * - 150-199:  Size restrictions
 * - 200-299:  Methods, protocols & restricted paths
 * - 300-399:  Scanner & bot fingerprints
 * - 400-499:  Known CVE patterns
 * - 500-599:  SQL injection
 * - 600-699:  XSS
 * - 700-799:  Path traversal, LFI, RFI & SSRF
 * - 800-849:  Node.js / app-specific
 * - 850-899:  Command injection / RCE
 * - 900-949:  Protocol attacks
 * - 950-999:  Miscellaneous
 * - 1000+:    Reserved for user custom rules
 */

import { escapeHcl } from '../../utils/terraform/escape-hcl.ts';

const TRANSFORMS_STANDARD = ['Lowercase', 'UrlDecode'];
const TRANSFORMS_LOWERCASE = ['Lowercase'];
const TRANSFORMS_URLDECODE = ['UrlDecode'];

interface WafMatchCondition {
  matchVariable:
    | 'RequestUri'
    | 'RequestMethod'
    | 'RequestHeader'
    | 'RequestBody'
    | 'SocketAddr'
    | 'QueryString';
  operator: 'Contains' | 'Equal' | 'IPMatch' | 'GreaterThan';
  matchValues: string[];
  transforms?: string[];
  selector?: string;
}

interface WafCustomRule {
  name: string;
  type: 'MatchRule' | 'RateLimitRule';
  priority: number;
  action: 'Block';
  matchConditions: WafMatchCondition[];
  rateLimitDurationInMinutes?: number;
  rateLimitThreshold?: number;
  comment: string;
}

const WAF_CUSTOM_RULES: WafCustomRule[] = [
  // ===== Rate Limiting (100-149) =====
  {
    name: 'RateLimitGlobal',
    type: 'RateLimitRule',
    priority: 100,
    action: 'Block',
    rateLimitDurationInMinutes: 1,
    rateLimitThreshold: 1000,
    matchConditions: [
      {
        matchVariable: 'SocketAddr',
        operator: 'IPMatch',
        matchValues: ['0.0.0.0/0', '::/0'],
      },
    ],
    comment: 'Rate limit: 1000 req/min per IP',
  },
  {
    name: 'RateLimitAuth',
    type: 'RateLimitRule',
    priority: 101,
    action: 'Block',
    rateLimitDurationInMinutes: 1,
    rateLimitThreshold: 50,
    matchConditions: [
      {
        matchVariable: 'RequestUri',
        operator: 'Contains',
        matchValues: [
          '/auth/',
          '/login',
          '/signin',
          '/signup',
          '/register',
          '/forgot',
          '/reset-password',
          '/token',
          '/oauth',
        ],
        transforms: TRANSFORMS_STANDARD,
      },
    ],
    comment: 'Rate limit: 50 req/min on auth endpoints',
  },
  {
    name: 'RateLimitAPI',
    type: 'RateLimitRule',
    priority: 102,
    action: 'Block',
    rateLimitDurationInMinutes: 1,
    rateLimitThreshold: 500,
    matchConditions: [
      {
        matchVariable: 'RequestUri',
        operator: 'Contains',
        matchValues: ['/api/'],
        transforms: TRANSFORMS_STANDARD,
      },
    ],
    comment: 'Rate limit: 500 req/min on API endpoints',
  },
  {
    name: 'RateLimitGraphQL',
    type: 'RateLimitRule',
    priority: 103,
    action: 'Block',
    rateLimitDurationInMinutes: 1,
    rateLimitThreshold: 200,
    matchConditions: [
      {
        matchVariable: 'RequestUri',
        operator: 'Contains',
        matchValues: ['/graphql'],
        transforms: TRANSFORMS_STANDARD,
      },
    ],
    comment: 'Rate limit: 200 req/min on GraphQL',
  },
  {
    name: 'RateLimitWebhooks',
    type: 'RateLimitRule',
    priority: 104,
    action: 'Block',
    rateLimitDurationInMinutes: 1,
    rateLimitThreshold: 300,
    matchConditions: [
      {
        matchVariable: 'RequestUri',
        operator: 'Contains',
        matchValues: ['/webhook', '/callback'],
        transforms: TRANSFORMS_STANDARD,
      },
    ],
    comment: 'Rate limit: 300 req/min on webhooks',
  },

  // ===== Size Restrictions (150-199) =====
  {
    name: 'BlockOversizedQueryString',
    type: 'MatchRule',
    priority: 150,
    action: 'Block',
    matchConditions: [
      {
        matchVariable: 'QueryString',
        operator: 'GreaterThan',
        matchValues: ['4096'],
      },
    ],
    comment: 'Block query strings > 4096 bytes',
  },
  {
    name: 'BlockOversizedCookies',
    type: 'MatchRule',
    priority: 151,
    action: 'Block',
    matchConditions: [
      {
        matchVariable: 'RequestHeader',
        selector: 'Cookie',
        operator: 'GreaterThan',
        matchValues: ['10240'],
      },
    ],
    comment: 'Block cookies > 10240 bytes',
  },
  {
    name: 'BlockOversizedURI',
    type: 'MatchRule',
    priority: 152,
    action: 'Block',
    matchConditions: [
      {
        matchVariable: 'RequestUri',
        operator: 'GreaterThan',
        matchValues: ['8192'],
      },
    ],
    comment: 'Block URIs > 8192 bytes',
  },
  {
    name: 'BlockOversizedHeaders',
    type: 'MatchRule',
    priority: 153,
    action: 'Block',
    matchConditions: [
      {
        matchVariable: 'RequestHeader',
        selector: 'User-Agent',
        operator: 'GreaterThan',
        matchValues: ['2048'],
      },
    ],
    comment: 'Block User-Agent > 2048 bytes',
  },

  // ===== Methods, Protocols & Restricted Paths (200-299) =====
  {
    name: 'BlockDangerousMethods',
    type: 'MatchRule',
    priority: 200,
    action: 'Block',
    matchConditions: [
      {
        matchVariable: 'RequestMethod',
        operator: 'Equal',
        matchValues: [
          'TRACE',
          'CONNECT',
          'PROPFIND',
          'PROPPATCH',
          'MKCOL',
          'COPY',
          'MOVE',
          'LOCK',
          'UNLOCK',
        ],
      },
    ],
    comment: 'Block WebDAV + debug methods',
  },
  {
    name: 'BlockRestrictedPaths',
    type: 'MatchRule',
    priority: 201,
    action: 'Block',
    matchConditions: [
      {
        matchVariable: 'RequestUri',
        operator: 'Contains',
        matchValues: [
          '/admin',
          '/wp-admin',
          '/wp-login',
          '/phpmyadmin',
          '/cgi-bin',
          '/xmlrpc.php',
          '/wp-cron',
          '/wp-content/uploads',
          '/wp-includes',
        ],
        transforms: TRANSFORMS_STANDARD,
      },
    ],
    comment: 'Block WordPress/CMS scanner paths',
  },
  {
    name: 'BlockHiddenFiles',
    type: 'MatchRule',
    priority: 202,
    action: 'Block',
    matchConditions: [
      {
        matchVariable: 'RequestUri',
        operator: 'Contains',
        matchValues: [
          '/.env',
          '/.git',
          '/.htaccess',
          '/.svn',
          '/.ds_store',
          '/.config',
          '/.ssh',
          '/.aws',
          '/.docker',
          '/.npmrc',
        ],
        transforms: TRANSFORMS_STANDARD,
      },
    ],
    comment: 'Block sensitive dotfile access',
  },
  {
    name: 'BlockHTTPSmugglingHeaders',
    type: 'MatchRule',
    priority: 203,
    action: 'Block',
    matchConditions: [
      {
        matchVariable: 'RequestHeader',
        selector: 'Transfer-Encoding',
        operator: 'Contains',
        matchValues: ['chunked,', ',chunked', 'chunked chunked'],
        transforms: TRANSFORMS_LOWERCASE,
      },
    ],
    comment: 'Block CL/TE desync smuggling',
  },
  {
    name: 'BlockRestrictedUploads',
    type: 'MatchRule',
    priority: 204,
    action: 'Block',
    matchConditions: [
      {
        matchVariable: 'RequestUri',
        operator: 'Contains',
        matchValues: [
          '.php',
          '.jsp',
          '.asp',
          '.aspx',
          '.cgi',
          '.exe',
          '.bat',
          '.cmd',
          '.sh',
          '.pl',
        ],
        transforms: TRANSFORMS_LOWERCASE,
      },
    ],
    comment: 'Block server-side script extensions',
  },
  {
    name: 'BlockBackupFiles',
    type: 'MatchRule',
    priority: 205,
    action: 'Block',
    matchConditions: [
      {
        matchVariable: 'RequestUri',
        operator: 'Contains',
        matchValues: [
          '.bak',
          '.backup',
          '.sql',
          '.dump',
          '.old',
          '.orig',
          '.save',
          '.swp',
          '.tmp',
          '.temp',
        ],
        transforms: TRANSFORMS_LOWERCASE,
      },
    ],
    comment: 'Block backup/temp file access',
  },
  {
    name: 'BlockSensitiveFiles',
    type: 'MatchRule',
    priority: 206,
    action: 'Block',
    matchConditions: [
      {
        matchVariable: 'RequestUri',
        operator: 'Contains',
        matchValues: [
          '.pem',
          '.key',
          '.pfx',
          '.p12',
          '.crt',
          '.cer',
          '.jks',
          '.keystore',
          '.tfstate',
          '.tfvars',
        ],
        transforms: TRANSFORMS_LOWERCASE,
      },
    ],
    comment: 'Block credential/infra file access',
  },
  {
    name: 'BlockPackageFiles',
    type: 'MatchRule',
    priority: 207,
    action: 'Block',
    matchConditions: [
      {
        matchVariable: 'RequestUri',
        operator: 'Contains',
        matchValues: [
          'package.json',
          'composer.json',
          'gemfile',
          'requirements.txt',
          'yarn.lock',
          'package-lock.json',
          'pnpm-lock.yaml',
          '.npmignore',
          'tsconfig.json',
          'dockerfile',
        ],
        transforms: TRANSFORMS_LOWERCASE,
      },
    ],
    comment: 'Block source/config file exposure',
  },

  // ===== Scanner & Bot Fingerprints (300-399) =====
  {
    name: 'BlockKnownScanners',
    type: 'MatchRule',
    priority: 300,
    action: 'Block',
    matchConditions: [
      {
        matchVariable: 'RequestHeader',
        selector: 'User-Agent',
        operator: 'Contains',
        matchValues: [
          'nikto',
          'sqlmap',
          'nessus',
          'dirbuster',
          'gobuster',
          'wpscan',
          'masscan',
          'nmap',
          'burpsuite',
          'acunetix',
        ],
        transforms: TRANSFORMS_LOWERCASE,
      },
    ],
    comment: 'Block known vulnerability scanners',
  },
  {
    name: 'BlockMoreScanners',
    type: 'MatchRule',
    priority: 301,
    action: 'Block',
    matchConditions: [
      {
        matchVariable: 'RequestHeader',
        selector: 'User-Agent',
        operator: 'Contains',
        matchValues: [
          'openvas',
          'qualys',
          'w3af',
          'arachni',
          'owasp-zap',
          'skipfish',
          'nuclei',
          'whatweb',
          'dalfox',
          'xsstrike',
        ],
        transforms: TRANSFORMS_LOWERCASE,
      },
    ],
    comment: 'Block additional vulnerability scanners',
  },

  // ===== Known CVE Patterns (400-499) =====
  {
    name: 'BlockLog4ShellUri',
    type: 'MatchRule',
    priority: 400,
    action: 'Block',
    matchConditions: [
      {
        matchVariable: 'RequestUri',
        operator: 'Contains',
        matchValues: ['${jndi:', '${jndi:ldap', '${jndi:rmi', '${jndi:dns'],
        transforms: TRANSFORMS_STANDARD,
      },
    ],
    comment: 'CVE-2021-44228 Log4Shell in URI',
  },
  {
    name: 'BlockLog4ShellHeaders',
    type: 'MatchRule',
    priority: 401,
    action: 'Block',
    matchConditions: [
      {
        matchVariable: 'RequestHeader',
        selector: 'User-Agent',
        operator: 'Contains',
        matchValues: ['${jndi:', '${jndi:ldap', '${jndi:rmi', '${jndi:dns'],
        transforms: TRANSFORMS_STANDARD,
      },
    ],
    comment: 'CVE-2021-44228 Log4Shell in headers',
  },
  {
    name: 'BlockLog4ShellBody',
    type: 'MatchRule',
    priority: 402,
    action: 'Block',
    matchConditions: [
      {
        matchVariable: 'RequestBody',
        operator: 'Contains',
        matchValues: ['${jndi:', '${jndi:ldap', '${jndi:rmi', '${jndi:dns'],
        transforms: TRANSFORMS_STANDARD,
      },
    ],
    comment: 'CVE-2021-44228 Log4Shell in body',
  },
  {
    name: 'BlockSpringShellUri',
    type: 'MatchRule',
    priority: 403,
    action: 'Block',
    matchConditions: [
      {
        matchVariable: 'RequestUri',
        operator: 'Contains',
        matchValues: [
          'class.module.classloader',
          'class.classloader',
          'spring.cloud.function',
          'functionrouter',
        ],
        transforms: TRANSFORMS_STANDARD,
      },
    ],
    comment: 'CVE-2022-22965/22963 Spring4Shell in URI',
  },
  {
    name: 'BlockSpringShellBody',
    type: 'MatchRule',
    priority: 404,
    action: 'Block',
    matchConditions: [
      {
        matchVariable: 'RequestBody',
        operator: 'Contains',
        matchValues: [
          'class.module.classloader',
          'class.classloader',
          'spring.cloud.function',
          'functionrouter',
        ],
        transforms: TRANSFORMS_STANDARD,
      },
    ],
    comment: 'CVE-2022-22965/22963 Spring4Shell in body',
  },
  {
    name: 'BlockShellshock',
    type: 'MatchRule',
    priority: 405,
    action: 'Block',
    matchConditions: [
      {
        matchVariable: 'RequestHeader',
        selector: 'User-Agent',
        operator: 'Contains',
        matchValues: ['() { :;};', '() { :; };', '(){:;};'],
      },
    ],
    comment: 'CVE-2014-6271 Shellshock',
  },

  // ===== SQL Injection (500-599) =====
  {
    name: 'BlockSQLiKeywordsUri',
    type: 'MatchRule',
    priority: 500,
    action: 'Block',
    matchConditions: [
      {
        matchVariable: 'RequestUri',
        operator: 'Contains',
        matchValues: [
          'union select',
          'union all select',
          'drop table',
          'insert into',
          'delete from',
          'update set',
          'alter table',
          'create table',
          'truncate table',
        ],
        transforms: TRANSFORMS_STANDARD,
      },
    ],
    comment: 'SQL injection keywords in URI',
  },
  {
    name: 'BlockSQLiKeywordsBody',
    type: 'MatchRule',
    priority: 501,
    action: 'Block',
    matchConditions: [
      {
        matchVariable: 'RequestBody',
        operator: 'Contains',
        matchValues: [
          'union select',
          'union all select',
          'drop table',
          'insert into',
          'delete from',
          'update set',
          'alter table',
          'create table',
          'truncate table',
        ],
        transforms: TRANSFORMS_STANDARD,
      },
    ],
    comment: 'SQL injection keywords in body',
  },
  {
    name: 'BlockSQLiFunctionsUri',
    type: 'MatchRule',
    priority: 502,
    action: 'Block',
    matchConditions: [
      {
        matchVariable: 'RequestUri',
        operator: 'Contains',
        matchValues: [
          'exec(',
          'execute(',
          'xp_cmdshell',
          'sp_executesql',
          'xp_regread',
          'xp_fileexist',
          'sp_password',
          'sp_configure',
        ],
        transforms: TRANSFORMS_STANDARD,
      },
    ],
    comment: 'SQL stored procedures/functions in URI',
  },
  {
    name: 'BlockSQLiFunctionsBody',
    type: 'MatchRule',
    priority: 503,
    action: 'Block',
    matchConditions: [
      {
        matchVariable: 'RequestBody',
        operator: 'Contains',
        matchValues: [
          'exec(',
          'execute(',
          'xp_cmdshell',
          'sp_executesql',
          'xp_regread',
          'xp_fileexist',
          'sp_password',
          'sp_configure',
        ],
        transforms: TRANSFORMS_STANDARD,
      },
    ],
    comment: 'SQL stored procedures/functions in body',
  },
  {
    name: 'BlockSQLiTimingUri',
    type: 'MatchRule',
    priority: 504,
    action: 'Block',
    matchConditions: [
      {
        matchVariable: 'RequestUri',
        operator: 'Contains',
        matchValues: [
          'sleep(',
          'benchmark(',
          'pg_sleep(',
          'waitfor delay',
          'waitfor time',
          'dbms_pipe.receive_message',
        ],
        transforms: TRANSFORMS_STANDARD,
      },
    ],
    comment: 'Blind SQLi timing attacks in URI',
  },
  {
    name: 'BlockSQLiTimingBody',
    type: 'MatchRule',
    priority: 505,
    action: 'Block',
    matchConditions: [
      {
        matchVariable: 'RequestBody',
        operator: 'Contains',
        matchValues: [
          'sleep(',
          'benchmark(',
          'pg_sleep(',
          'waitfor delay',
          'waitfor time',
          'dbms_pipe.receive_message',
        ],
        transforms: TRANSFORMS_STANDARD,
      },
    ],
    comment: 'Blind SQLi timing attacks in body',
  },
  {
    name: 'BlockSQLiAuthBypassUri',
    type: 'MatchRule',
    priority: 506,
    action: 'Block',
    matchConditions: [
      {
        matchVariable: 'RequestUri',
        operator: 'Contains',
        matchValues: [
          "' or '",
          "' or 1=1",
          '" or "',
          '" or 1=1',
          "' or 'a'='a",
          "') or ('",
          "admin'--",
          "1' or '1'='1",
        ],
        transforms: TRANSFORMS_STANDARD,
      },
    ],
    comment: 'SQL auth bypass patterns in URI',
  },
  {
    name: 'BlockSQLiAuthBypassBody',
    type: 'MatchRule',
    priority: 507,
    action: 'Block',
    matchConditions: [
      {
        matchVariable: 'RequestBody',
        operator: 'Contains',
        matchValues: [
          "' or '",
          "' or 1=1",
          '" or "',
          '" or 1=1',
          "' or 'a'='a",
          "') or ('",
          "admin'--",
          "1' or '1'='1",
        ],
        transforms: TRANSFORMS_STANDARD,
      },
    ],
    comment: 'SQL auth bypass patterns in body',
  },
  {
    name: 'BlockSQLiMetaTablesUri',
    type: 'MatchRule',
    priority: 508,
    action: 'Block',
    matchConditions: [
      {
        matchVariable: 'RequestUri',
        operator: 'Contains',
        matchValues: [
          'information_schema',
          'pg_catalog',
          'sys.tables',
          'sys.columns',
          'sysobjects',
          'mysql.user',
          'sqlite_master',
          'all_tables',
        ],
        transforms: TRANSFORMS_STANDARD,
      },
    ],
    comment: 'SQL meta-table reconnaissance in URI',
  },
  {
    name: 'BlockSQLiMetaTablesBody',
    type: 'MatchRule',
    priority: 509,
    action: 'Block',
    matchConditions: [
      {
        matchVariable: 'RequestBody',
        operator: 'Contains',
        matchValues: [
          'information_schema',
          'pg_catalog',
          'sys.tables',
          'sys.columns',
          'sysobjects',
          'mysql.user',
          'sqlite_master',
          'all_tables',
        ],
        transforms: TRANSFORMS_STANDARD,
      },
    ],
    comment: 'SQL meta-table reconnaissance in body',
  },
  {
    name: 'BlockSQLiCommentsUri',
    type: 'MatchRule',
    priority: 510,
    action: 'Block',
    matchConditions: [
      {
        matchVariable: 'RequestUri',
        operator: 'Contains',
        matchValues: ['/**/', '/*!', '--+', '#--', ';--', "' --", "') --"],
        transforms: TRANSFORMS_STANDARD,
      },
    ],
    comment: 'SQL comment injection in URI',
  },
  {
    name: 'BlockSQLiCookieHeader',
    type: 'MatchRule',
    priority: 511,
    action: 'Block',
    matchConditions: [
      {
        matchVariable: 'RequestHeader',
        selector: 'Cookie',
        operator: 'Contains',
        matchValues: [
          'union select',
          "' or '",
          "' or 1=1",
          'sleep(',
          'benchmark(',
          'drop table',
          'information_schema',
          'xp_cmdshell',
        ],
        transforms: TRANSFORMS_STANDARD,
      },
    ],
    comment: 'SQL injection via cookies',
  },

  // ===== XSS (600-699) =====
  {
    name: 'BlockXSSScriptTagsUri',
    type: 'MatchRule',
    priority: 600,
    action: 'Block',
    matchConditions: [
      {
        matchVariable: 'RequestUri',
        operator: 'Contains',
        matchValues: [
          '<script',
          '</script',
          '<iframe',
          '</iframe',
          '<object',
          '<embed',
          '<applet',
          '<form',
          '<meta',
          '<svg',
        ],
        transforms: TRANSFORMS_STANDARD,
      },
    ],
    comment: 'XSS HTML injection tags in URI',
  },
  {
    name: 'BlockXSSScriptTagsBody',
    type: 'MatchRule',
    priority: 601,
    action: 'Block',
    matchConditions: [
      {
        matchVariable: 'RequestBody',
        operator: 'Contains',
        matchValues: [
          '<script',
          '</script',
          '<iframe',
          '</iframe',
          '<object',
          '<embed',
          '<applet',
          '<form',
          '<meta',
          '<svg',
        ],
        transforms: TRANSFORMS_STANDARD,
      },
    ],
    comment: 'XSS HTML injection tags in body',
  },
  {
    name: 'BlockXXEBody',
    type: 'MatchRule',
    priority: 602,
    action: 'Block',
    matchConditions: [
      {
        matchVariable: 'RequestBody',
        operator: 'Contains',
        matchValues: [
          '<!entity',
          '<!doctype',
          'system "http',
          "system 'http",
          'public "http',
          "public 'http",
          '<!element',
          '<!attlist',
        ],
        transforms: TRANSFORMS_LOWERCASE,
      },
    ],
    comment: 'XML external entity injection in body',
  },
  {
    name: 'BlockXSSProtocolsUri',
    type: 'MatchRule',
    priority: 603,
    action: 'Block',
    matchConditions: [
      {
        matchVariable: 'RequestUri',
        operator: 'Contains',
        matchValues: [
          'javascript:',
          'vbscript:',
          'data:text/html',
          'data:application/x-javascript',
          'data:text/javascript',
        ],
        transforms: TRANSFORMS_STANDARD,
      },
    ],
    comment: 'XSS protocol handlers in URI',
  },
  {
    name: 'BlockXSSProtocolsBody',
    type: 'MatchRule',
    priority: 604,
    action: 'Block',
    matchConditions: [
      {
        matchVariable: 'RequestBody',
        operator: 'Contains',
        matchValues: [
          'javascript:',
          'vbscript:',
          'data:text/html',
          'data:application/x-javascript',
          'data:text/javascript',
        ],
        transforms: TRANSFORMS_STANDARD,
      },
    ],
    comment: 'XSS protocol handlers in body',
  },
  {
    name: 'BlockXSSEventHandlersUri1',
    type: 'MatchRule',
    priority: 605,
    action: 'Block',
    matchConditions: [
      {
        matchVariable: 'RequestUri',
        operator: 'Contains',
        matchValues: [
          'onerror=',
          'onload=',
          'onfocus=',
          'onmouseover=',
          'onclick=',
          'onsubmit=',
          'oninput=',
          'onchange=',
          'onkeyup=',
          'onkeydown=',
        ],
        transforms: TRANSFORMS_STANDARD,
      },
    ],
    comment: 'XSS event handlers batch 1 in URI',
  },
  {
    name: 'BlockXSSEventHandlersUri2',
    type: 'MatchRule',
    priority: 606,
    action: 'Block',
    matchConditions: [
      {
        matchVariable: 'RequestUri',
        operator: 'Contains',
        matchValues: [
          'onkeypress=',
          'onmouseout=',
          'onmouseenter=',
          'onmouseleave=',
          'ondblclick=',
          'oncontextmenu=',
          'ondrag=',
          'ondrop=',
          'onblur=',
          'onscroll=',
        ],
        transforms: TRANSFORMS_STANDARD,
      },
    ],
    comment: 'XSS event handlers batch 2 in URI',
  },
  {
    name: 'BlockXSSEventHandlersBody',
    type: 'MatchRule',
    priority: 607,
    action: 'Block',
    matchConditions: [
      {
        matchVariable: 'RequestBody',
        operator: 'Contains',
        matchValues: [
          'onerror=',
          'onload=',
          'onfocus=',
          'onmouseover=',
          'onclick=',
          'onsubmit=',
          'oninput=',
          'onchange=',
          'onkeyup=',
          'onkeydown=',
        ],
        transforms: TRANSFORMS_STANDARD,
      },
    ],
    comment: 'XSS event handlers in body',
  },
  {
    name: 'BlockXSSDOMMethodsUri',
    type: 'MatchRule',
    priority: 608,
    action: 'Block',
    matchConditions: [
      {
        matchVariable: 'RequestUri',
        operator: 'Contains',
        matchValues: [
          'document.cookie',
          'document.write',
          'document.domain',
          'window.location',
          '.innerhtml',
          'eval(',
          'settimeout(',
          'setinterval(',
          'function(',
          'string.fromcharcode',
        ],
        transforms: TRANSFORMS_STANDARD,
      },
    ],
    comment: 'XSS DOM manipulation in URI',
  },
  {
    name: 'BlockXSSDOMMethodsBody',
    type: 'MatchRule',
    priority: 609,
    action: 'Block',
    matchConditions: [
      {
        matchVariable: 'RequestBody',
        operator: 'Contains',
        matchValues: [
          'document.cookie',
          'document.write',
          'document.domain',
          'window.location',
          '.innerhtml',
          'eval(',
          'settimeout(',
          'setinterval(',
          'function(',
          'string.fromcharcode',
        ],
        transforms: TRANSFORMS_STANDARD,
      },
    ],
    comment: 'XSS DOM manipulation in body',
  },

  // ===== Path Traversal, LFI, RFI & SSRF (700-799) =====
  {
    name: 'BlockPathTraversalUri',
    type: 'MatchRule',
    priority: 700,
    action: 'Block',
    matchConditions: [
      {
        matchVariable: 'RequestUri',
        operator: 'Contains',
        matchValues: [
          '../',
          '..\\',
          '..%2f',
          '..%5c',
          '%2e%2e/',
          '%2e%2e%2f',
          '..%252f',
          '..../',
          '..;/',
        ],
        transforms: TRANSFORMS_URLDECODE,
      },
    ],
    comment: 'Path traversal with encoding variants in URI',
  },
  {
    name: 'BlockOSFileAccessUri',
    type: 'MatchRule',
    priority: 701,
    action: 'Block',
    matchConditions: [
      {
        matchVariable: 'RequestUri',
        operator: 'Contains',
        matchValues: [
          '/etc/passwd',
          '/etc/shadow',
          '/etc/hosts',
          '/proc/self',
          '/proc/version',
          '/proc/net',
          '/proc/cmdline',
          '/dev/null',
          '/dev/random',
          '/dev/urandom',
        ],
        transforms: TRANSFORMS_STANDARD,
      },
    ],
    comment: 'Unix OS file access in URI',
  },
  {
    name: 'BlockSensitiveDirAccessUri',
    type: 'MatchRule',
    priority: 702,
    action: 'Block',
    matchConditions: [
      {
        matchVariable: 'RequestUri',
        operator: 'Contains',
        matchValues: [
          '.ssh/',
          '.aws/credentials',
          '.aws/config',
          '.azure/',
          '.gcloud/',
          '.kube/config',
          '.docker/config',
          '.npmrc',
          '.netrc',
          '.bash_history',
        ],
        transforms: TRANSFORMS_STANDARD,
      },
    ],
    comment: 'Cloud/dev credential file access in URI',
  },
  {
    name: 'BlockSSRFMetadataUri',
    type: 'MatchRule',
    priority: 703,
    action: 'Block',
    matchConditions: [
      {
        matchVariable: 'RequestUri',
        operator: 'Contains',
        matchValues: [
          '169.254.169.254',
          'metadata.google.internal',
          '100.100.100.200',
          'metadata.azure.com',
          '169.254.170.2',
        ],
        transforms: TRANSFORMS_STANDARD,
      },
    ],
    comment: 'SSRF cloud metadata endpoint protection',
  },
  {
    name: 'BlockSSRFLocalhostUri',
    type: 'MatchRule',
    priority: 704,
    action: 'Block',
    matchConditions: [
      {
        matchVariable: 'RequestUri',
        operator: 'Contains',
        matchValues: [
          '127.0.0.1',
          '0.0.0.0',
          '[::1]',
          'localhost:',
          '0177.0.0.1',
          '2130706433',
          '017700000001',
          '0x7f000001',
        ],
        transforms: TRANSFORMS_STANDARD,
      },
    ],
    comment: 'SSRF localhost/loopback in URI',
  },
  {
    name: 'BlockSSRFLocalhostBody',
    type: 'MatchRule',
    priority: 705,
    action: 'Block',
    matchConditions: [
      {
        matchVariable: 'RequestBody',
        operator: 'Contains',
        matchValues: [
          '127.0.0.1',
          '0.0.0.0',
          '[::1]',
          'localhost:',
          '0177.0.0.1',
          '2130706433',
          '017700000001',
          '0x7f000001',
        ],
        transforms: TRANSFORMS_STANDARD,
      },
    ],
    comment: 'SSRF localhost/loopback in body',
  },
  {
    name: 'BlockRFIProtocolsUri',
    type: 'MatchRule',
    priority: 706,
    action: 'Block',
    matchConditions: [
      {
        matchVariable: 'RequestUri',
        operator: 'Contains',
        matchValues: [
          '=http://',
          '=https://',
          '=ftp://',
          '=ftps://',
          '=file://',
          '=gopher://',
          '=data://',
          '=php://',
          '=phar://',
        ],
        transforms: TRANSFORMS_STANDARD,
      },
    ],
    comment: 'RFI via query params in URI',
  },
  {
    name: 'BlockRFIProtocolsBody',
    type: 'MatchRule',
    priority: 707,
    action: 'Block',
    matchConditions: [
      {
        matchVariable: 'RequestBody',
        operator: 'Contains',
        matchValues: [
          'file://',
          'gopher://',
          'data://',
          'php://',
          'phar://',
          'jar://',
          'expect://',
          'zip://',
        ],
        transforms: TRANSFORMS_STANDARD,
      },
    ],
    comment: 'RFI dangerous protocols in body',
  },
  {
    name: 'BlockRestrictedExtensions',
    type: 'MatchRule',
    priority: 708,
    action: 'Block',
    matchConditions: [
      {
        matchVariable: 'RequestUri',
        operator: 'Contains',
        matchValues: ['.log', '.conf', '.ini'],
        transforms: TRANSFORMS_LOWERCASE,
      },
    ],
    comment: 'Block config file extensions',
  },
  {
    name: 'BlockPathTraversalBody',
    type: 'MatchRule',
    priority: 709,
    action: 'Block',
    matchConditions: [
      {
        matchVariable: 'RequestBody',
        operator: 'Contains',
        matchValues: [
          '../',
          '..\\',
          '..%2f',
          '..%5c',
          '/etc/passwd',
          '/etc/shadow',
          '/proc/self',
          '.ssh/',
        ],
        transforms: TRANSFORMS_URLDECODE,
      },
    ],
    comment: 'Path traversal patterns in body',
  },

  // ===== Node.js / App-Specific (800-849) =====
  {
    name: 'BlockProtoPollutionUri',
    type: 'MatchRule',
    priority: 800,
    action: 'Block',
    matchConditions: [
      {
        matchVariable: 'RequestUri',
        operator: 'Contains',
        matchValues: [
          '__proto__',
          'constructor.prototype',
          'constructor[',
          '.__proto__[',
          '["__proto__"]',
          "['__proto__']",
        ],
        transforms: TRANSFORMS_STANDARD,
      },
    ],
    comment: 'Prototype pollution in URI',
  },
  {
    name: 'BlockProtoPollutionBody',
    type: 'MatchRule',
    priority: 801,
    action: 'Block',
    matchConditions: [
      {
        matchVariable: 'RequestBody',
        operator: 'Contains',
        matchValues: [
          '__proto__',
          'constructor.prototype',
          'constructor[',
          '.__proto__[',
          '["__proto__"]',
          "['__proto__']",
        ],
        transforms: TRANSFORMS_STANDARD,
      },
    ],
    comment: 'Prototype pollution in body',
  },
  {
    name: 'BlockNodeCodeInjectionUri',
    type: 'MatchRule',
    priority: 802,
    action: 'Block',
    matchConditions: [
      {
        matchVariable: 'RequestUri',
        operator: 'Contains',
        matchValues: [
          'child_process',
          "require('child",
          'require("child',
          "require('fs",
          'require("fs',
          'process.env',
          'process.exit',
          'process.binding',
        ],
        transforms: TRANSFORMS_STANDARD,
      },
    ],
    comment: 'Node.js module injection in URI',
  },
  {
    name: 'BlockNodeCodeInjectionBody',
    type: 'MatchRule',
    priority: 803,
    action: 'Block',
    matchConditions: [
      {
        matchVariable: 'RequestBody',
        operator: 'Contains',
        matchValues: [
          'child_process',
          "require('child",
          'require("child',
          "require('fs",
          'require("fs',
          'process.env',
          'process.exit',
          'process.binding',
        ],
        transforms: TRANSFORMS_STANDARD,
      },
    ],
    comment: 'Node.js module injection in body',
  },
  {
    name: 'BlockNodeTemplateInjectionUri',
    type: 'MatchRule',
    priority: 804,
    action: 'Block',
    matchConditions: [
      {
        matchVariable: 'RequestUri',
        operator: 'Contains',
        matchValues: [
          '#{7*7}',
          '${7*7}',
          '{{7*7}}',
          '{{constructor',
          '<%=',
          '${constructor',
          '${7*191}',
        ],
        transforms: TRANSFORMS_STANDARD,
      },
    ],
    comment: 'Server-side template injection in URI',
  },
  {
    name: 'BlockNodeTemplateInjectionBody',
    type: 'MatchRule',
    priority: 805,
    action: 'Block',
    matchConditions: [
      {
        matchVariable: 'RequestBody',
        operator: 'Contains',
        matchValues: [
          '#{7*7}',
          '${7*7}',
          '{{7*7}}',
          '{{constructor',
          '<%=',
          '${constructor',
          '${7*191}',
        ],
        transforms: TRANSFORMS_STANDARD,
      },
    ],
    comment: 'Server-side template injection in body',
  },

  // ===== Command Injection / RCE (850-899) =====
  {
    name: 'BlockOSCommandMetacharsUri',
    type: 'MatchRule',
    priority: 850,
    action: 'Block',
    matchConditions: [
      {
        matchVariable: 'RequestUri',
        operator: 'Contains',
        matchValues: [
          '; ls',
          '| cat',
          '&& cat',
          '|| cat',
          '$(cat',
          '; curl ',
          '; wget ',
          '| nc ',
          '&& wget',
          '$(wget',
        ],
        transforms: TRANSFORMS_STANDARD,
      },
    ],
    comment: 'Shell metacharacters + commands in URI',
  },
  {
    name: 'BlockOSCommandMetacharsBody',
    type: 'MatchRule',
    priority: 851,
    action: 'Block',
    matchConditions: [
      {
        matchVariable: 'RequestBody',
        operator: 'Contains',
        matchValues: [
          '; ls',
          '| cat',
          '&& cat',
          '|| cat',
          '$(cat',
          '; curl ',
          '; wget ',
          '| nc ',
          '&& wget',
          '$(wget',
        ],
        transforms: TRANSFORMS_STANDARD,
      },
    ],
    comment: 'Shell metacharacters + commands in body',
  },
  {
    name: 'BlockOSCommandNamesUri',
    type: 'MatchRule',
    priority: 852,
    action: 'Block',
    matchConditions: [
      {
        matchVariable: 'RequestUri',
        operator: 'Contains',
        matchValues: [
          '`whoami`',
          '`id`',
          '`uname`',
          '; whoami',
          '; id',
          '; uname',
          '; cat /',
          '; head /',
          '; tail /',
          '; less /',
        ],
        transforms: TRANSFORMS_STANDARD,
      },
    ],
    comment: 'Direct command execution in URI',
  },
  {
    name: 'BlockOSCommandNamesBody',
    type: 'MatchRule',
    priority: 853,
    action: 'Block',
    matchConditions: [
      {
        matchVariable: 'RequestBody',
        operator: 'Contains',
        matchValues: [
          '`whoami`',
          '`id`',
          '`uname`',
          '; whoami',
          '; id',
          '; uname',
          '; cat /',
          '; head /',
          '; tail /',
          '; less /',
        ],
        transforms: TRANSFORMS_STANDARD,
      },
    ],
    comment: 'Direct command execution in body',
  },
  {
    name: 'BlockShellKeywordsUri',
    type: 'MatchRule',
    priority: 854,
    action: 'Block',
    matchConditions: [
      {
        matchVariable: 'RequestUri',
        operator: 'Contains',
        matchValues: [
          '/bin/bash',
          '/bin/sh',
          '/bin/zsh',
          '/usr/bin/env',
          'bash -c',
          'sh -c',
          'bash -i',
          'sh -i',
        ],
        transforms: TRANSFORMS_STANDARD,
      },
    ],
    comment: 'Shell interpreter paths in URI',
  },
  {
    name: 'BlockShellKeywordsBody',
    type: 'MatchRule',
    priority: 855,
    action: 'Block',
    matchConditions: [
      {
        matchVariable: 'RequestBody',
        operator: 'Contains',
        matchValues: [
          '/bin/bash',
          '/bin/sh',
          '/bin/zsh',
          '/usr/bin/env',
          'bash -c',
          'sh -c',
          'bash -i',
          'sh -i',
        ],
        transforms: TRANSFORMS_STANDARD,
      },
    ],
    comment: 'Shell interpreter paths in body',
  },

  // ===== Protocol Attacks (900-949) =====
  {
    name: 'BlockResponseSplittingUri',
    type: 'MatchRule',
    priority: 900,
    action: 'Block',
    matchConditions: [
      {
        matchVariable: 'RequestUri',
        operator: 'Contains',
        matchValues: [
          '%0d%0a',
          '%0d%0aset-cookie',
          '%0d%0alocation',
          '%0d%0a%0d%0a',
          '%0d%0acontent-type',
        ],
        transforms: TRANSFORMS_LOWERCASE,
      },
    ],
    comment: 'HTTP response splitting via encoded CRLF',
  },
  {
    name: 'BlockLDAPInjectionUri',
    type: 'MatchRule',
    priority: 901,
    action: 'Block',
    matchConditions: [
      {
        matchVariable: 'RequestUri',
        operator: 'Contains',
        matchValues: [
          ')(cn=',
          ')(uid=',
          ')(&(',
          ')(|(',
          ')(mail=',
          ')(objectclass=',
          ')(sn=',
          ')(givenname=',
        ],
        transforms: TRANSFORMS_STANDARD,
      },
    ],
    comment: 'LDAP injection patterns in URI',
  },
  {
    name: 'BlockRequestSmugglingBody',
    type: 'MatchRule',
    priority: 902,
    action: 'Block',
    matchConditions: [
      {
        matchVariable: 'RequestBody',
        operator: 'Contains',
        matchValues: ['transfer-encoding:', 'content-length:'],
        transforms: TRANSFORMS_LOWERCASE,
      },
    ],
    comment: 'HTTP smuggling via injected headers in body',
  },
  {
    name: 'BlockHostHeaderAttack',
    type: 'MatchRule',
    priority: 903,
    action: 'Block',
    matchConditions: [
      {
        matchVariable: 'RequestHeader',
        selector: 'Host',
        operator: 'Contains',
        matchValues: [
          '127.0.0.1',
          'localhost',
          '0.0.0.0',
          '[::1]',
          '169.254.169.254',
        ],
        transforms: TRANSFORMS_LOWERCASE,
      },
    ],
    comment: 'Host header poisoning for SSRF',
  },

  // ===== Miscellaneous (950-999) =====
  {
    name: 'BlockWebShellPatternsUri',
    type: 'MatchRule',
    priority: 950,
    action: 'Block',
    matchConditions: [
      {
        matchVariable: 'RequestUri',
        operator: 'Contains',
        matchValues: [
          'system(',
          'passthru(',
          'popen(',
          'proc_open(',
          'shell_exec(',
          'phpinfo(',
          'c99shell',
          'r57shell',
          'webshell',
          'b374k',
        ],
        transforms: TRANSFORMS_STANDARD,
      },
    ],
    comment: 'Web shell function calls + known shells in URI',
  },
  {
    name: 'BlockWebShellPatternsBody',
    type: 'MatchRule',
    priority: 951,
    action: 'Block',
    matchConditions: [
      {
        matchVariable: 'RequestBody',
        operator: 'Contains',
        matchValues: [
          'system(',
          'passthru(',
          'popen(',
          'proc_open(',
          'shell_exec(',
          'phpinfo(',
          'c99shell',
          'r57shell',
          'webshell',
          'b374k',
        ],
        transforms: TRANSFORMS_STANDARD,
      },
    ],
    comment: 'Web shell function calls + known shells in body',
  },
  {
    name: 'BlockEncodedPayloadsUri',
    type: 'MatchRule',
    priority: 952,
    action: 'Block',
    matchConditions: [
      {
        matchVariable: 'RequestUri',
        operator: 'Contains',
        matchValues: [
          'base64_decode',
          'convert_uuencode',
          'rot13',
          'str_rot13',
          'fromcharcode',
          'charcodeat',
          'atob(',
          'btoa(',
          'unescape(',
        ],
        transforms: TRANSFORMS_STANDARD,
      },
    ],
    comment: 'Encoding evasion attempts in URI',
  },
  {
    name: 'BlockEncodedPayloadsBody',
    type: 'MatchRule',
    priority: 953,
    action: 'Block',
    matchConditions: [
      {
        matchVariable: 'RequestBody',
        operator: 'Contains',
        matchValues: [
          'base64_decode',
          'convert_uuencode',
          'rot13',
          'str_rot13',
          'fromcharcode',
          'charcodeat',
          'atob(',
          'btoa(',
          'unescape(',
        ],
        transforms: TRANSFORMS_STANDARD,
      },
    ],
    comment: 'Encoding evasion attempts in body',
  },
  {
    name: 'BlockSQLiHeaderReferer',
    type: 'MatchRule',
    priority: 954,
    action: 'Block',
    matchConditions: [
      {
        matchVariable: 'RequestHeader',
        selector: 'Referer',
        operator: 'Contains',
        matchValues: [
          'union select',
          "' or '",
          "' or 1=1",
          '<script',
          'javascript:',
          'onerror=',
          'onload=',
        ],
        transforms: TRANSFORMS_STANDARD,
      },
    ],
    comment: 'SQLi/XSS via Referer header',
  },
  {
    name: 'BlockXSSCookieHeader',
    type: 'MatchRule',
    priority: 955,
    action: 'Block',
    matchConditions: [
      {
        matchVariable: 'RequestHeader',
        selector: 'Cookie',
        operator: 'Contains',
        matchValues: [
          '<script',
          'javascript:',
          'onerror=',
          'onload=',
          'document.cookie',
          'eval(',
          '.innerhtml',
        ],
        transforms: TRANSFORMS_STANDARD,
      },
    ],
    comment: 'XSS via Cookie header',
  },
];

function renderMatchCondition(mc: WafMatchCondition): string {
  const values = mc.matchValues.map((v) => `"${escapeHcl(v)}"`).join(', ');
  const lines = [
    `    match_condition {`,
    `      match_variable = "${mc.matchVariable}"`,
  ];

  if (mc.selector) {
    lines.push(`      selector       = "${mc.selector}"`);
  }

  lines.push(`      operator       = "${mc.operator}"`);
  lines.push(`      match_values   = [${values}]`);

  if (mc.transforms && mc.transforms.length > 0) {
    const transforms = mc.transforms.map((t) => `"${t}"`).join(', ');
    lines.push(`      transforms     = [${transforms}]`);
  }

  lines.push(`    }`);
  return lines.join('\n');
}

interface WafCustomRulesOptions {
  /** Skip rules in priority bands 500-899 (covered by DRS 2.1 managed rulesets on Premium) */
  skipManagedBands?: boolean;
}

export function generateWafCustomRules(
  options?: WafCustomRulesOptions,
): string {
  const rules = options?.skipManagedBands
    ? WAF_CUSTOM_RULES.filter(
        (rule) => rule.priority < 500 || rule.priority > 899,
      )
    : WAF_CUSTOM_RULES;

  return rules
    .map((rule) => {
      const matchConditionsHcl = rule.matchConditions
        .map((mc) => renderMatchCondition(mc))
        .join('\n\n');

      const rateLimitFields =
        rule.type === 'RateLimitRule'
          ? `
    rate_limit_duration_in_minutes = ${rule.rateLimitDurationInMinutes}
    rate_limit_threshold           = ${rule.rateLimitThreshold}
`
          : '';

      return `  # ${rule.comment}
  custom_rule {
    name     = "${rule.name}"
    type     = "${rule.type}"
    priority = ${rule.priority}
    action   = "${rule.action}"
${rateLimitFields}
${matchConditionsHcl}
  }`;
    })
    .join('\n\n');
}
