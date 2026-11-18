import { describe, it, expect } from '@rstest/core';
import * as crypto from 'crypto';
import * as vm from 'vm';
import * as stream from 'stream';
import * as streamPromises from 'stream/promises';
import { EventEmitter } from 'events';
import { generateDbInit, type DbInitCloud } from './generate-db-init';

const SQL = {
  server: '-- server part',
  database: '-- database part',
};

function filesFor(cloud: DbInitCloud) {
  return generateDbInit({ cloud, sql: SQL, appRoleSuffix: '_app' });
}

interface Query {
  database: string;
  sql: string;
  params?: unknown[];
}

interface Run {
  queries: Query[];
  /** Secret keys in write order ({scope}-{KEY}) */
  writes: string[];
  /** Queries and writes, in order */
  events: string[];
  /** Secret values by {scope}-{KEY} */
  secrets: Record<string, string>;
  errors: string[];
  exitCode: number | undefined;
  /** User the script connected as */
  users: string[];
  /** Azure: Key Vault secrets by {vault}/{name} */
  vaultSecrets?: Record<string, string>;
  /** pg_dump and pg_restore runs: arguments, environment, what they read */
  tools: ToolRun[];
  /** The file store: {bucket or container}/{file} */
  files: Record<string, Buffer>;
  /** What the script logged */
  logs: string[];
}

interface ToolRun {
  command: string;
  args: string[];
  env: Record<string, string>;
  /** What the script wrote to the tool (pg_restore) */
  stdin: Buffer;
}

/** How a stand-in pg_dump or pg_restore behaves */
interface ToolBehaviour {
  /** pg_dump: what it writes */
  output?: string;
  exitCode?: number;
  stderr?: string;
}

/**
 * Runs the generated index.js in a sandbox: pg and the cloud's secret store
 * are stand-ins that record what the script sends
 */
async function runScript(
  cloud: DbInitCloud,
  options: {
    secrets?: Record<string, string>;
    databaseExists?: boolean;
    roles?: string[];
    /** A query that fails (`times`: only that many times) */
    failOn?: { sql: string; error: Error; times?: number };
    env?: Record<string, string>;
    /** Connection attempts that fail before one succeeds */
    connectFailures?: { count: number; code: string };
    /** Azure: secrets by {vault}/{name} */
    vaultSecrets?: Record<string, string>;
    /** Azure: requests a vault refuses (403) before its role applies */
    vaultRefusals?: Record<string, number>;
    /** Azure: deleted secrets ({vault}/{name}) that still hold their names */
    vaultDeleted?: string[];
    tools?: { pg_dump?: ToolBehaviour; pg_restore?: ToolBehaviour };
    /** Files already in the store: {bucket or container}/{file} */
    files?: Record<string, string>;
    /** The admin already has the app role's rights */
    adminInApp?: boolean;
  } = {},
): Promise<Run> {
  const run: Run = {
    queries: [],
    writes: [],
    events: [],
    secrets: { ...options.secrets },
    errors: [],
    exitCode: undefined,
    users: [],
    tools: [],
    files: Object.fromEntries(
      Object.entries(options.files ?? {}).map(([k, v]) => [k, Buffer.from(v)]),
    ),
    logs: [],
  };
  const roles = new Set(options.roles ?? []);
  const failOn = options.failOn ? { ...options.failOn } : undefined;

  class Client {
    constructor(private readonly config: { database: string; user: string }) {
      run.users.push(config.user);
    }
    async connect(): Promise<void> {
      if (options.connectFailures && options.connectFailures.count > 0) {
        options.connectFailures.count--;
        throw Object.assign(new Error('connect failed'), {
          code: options.connectFailures.code,
        });
      }
    }
    async end(): Promise<void> {}
    escapeLiteral(value: string): string {
      return `'${value.replace(/'/g, "''")}'`;
    }
    async query(sql: string, params?: unknown[]) {
      run.queries.push({ database: this.config.database, sql, params });
      run.events.push(`query ${this.config.database}: ${sql.slice(0, 40)}`);
      if (failOn && sql === failOn.sql && (failOn.times ?? 1) > 0) {
        if (failOn.times !== undefined) failOn.times--;
        throw failOn.error;
      }
      if (sql.startsWith('SELECT 1 FROM pg_database')) {
        return { rowCount: options.databaseExists === false ? 0 : 1 };
      }
      if (sql.startsWith('SELECT pg_encoding_to_char')) {
        return options.databaseExists === false
          ? { rowCount: 0, rows: [] }
          : {
              rowCount: 1,
              rows: [
                {
                  encoding: 'UTF8',
                  datcollate: 'en_US.UTF8',
                  datctype: 'en_US.UTF8',
                },
              ],
            };
      }
      if (sql.startsWith('SELECT pg_has_role')) {
        return { rowCount: 1, rows: [{ member: options.adminInApp ?? false }] };
      }
      if (sql.startsWith('SELECT 1 FROM pg_roles')) {
        return { rowCount: roles.has(String(params?.[0])) ? 1 : 0 };
      }
      return { rowCount: 0, rows: [] };
    }
  }

  const named = (name: string) => Object.assign(new Error(name), { name });
  const record = (key: string, value: string) => {
    run.secrets[key] = value;
    run.writes.push(key);
    run.events.push(`write ${key}`);
  };

  // AWS: names are {project}-{scope}-{KEY}; the key here drops the project
  const awsKey = (name: string) => name.replace(/^shop-/, '');
  class GetSecretValueCommand {
    constructor(readonly input: { SecretId: string }) {}
    run() {
      const key = awsKey(this.input.SecretId);
      if (!(key in run.secrets)) throw named('ResourceNotFoundException');
      return { SecretString: run.secrets[key] };
    }
  }
  class CreateSecretCommand {
    constructor(readonly input: { Name: string; SecretString: string }) {}
    run() {
      const key = awsKey(this.input.Name);
      if (key in run.secrets) throw named('ResourceExistsException');
      record(key, this.input.SecretString);
      return {};
    }
  }
  class PutSecretValueCommand {
    constructor(readonly input: { SecretId: string; SecretString: string }) {}
    run() {
      record(awsKey(this.input.SecretId), this.input.SecretString);
      return {};
    }
  }
  class SecretsManagerClient {
    async send(command: { run: () => unknown }) {
      return command.run();
    }
  }

  // GCP: projects/{GCP_PROJECT_ID}/secrets/{project}-{scope}-{KEY}
  const gcpPrefix = 'projects/gcp-shop/secrets/shop-';
  class SecretManagerServiceClient {
    async accessSecretVersion(request: { name: string }) {
      const key = request.name
        .replace(gcpPrefix, '')
        .replace('/versions/latest', '');
      if (!(key in run.secrets)) {
        throw Object.assign(new Error('NOT_FOUND'), { code: 5 });
      }
      return [{ payload: { data: Buffer.from(run.secrets[key], 'utf8') } }];
    }
    async addSecretVersion(request: {
      parent: string;
      payload: { data: Buffer };
    }) {
      record(
        request.parent.replace(gcpPrefix, ''),
        request.payload.data.toString('utf8'),
      );
      return [{}];
    }
  }

  // Azure: Key Vault secrets by {vault}/{name}; writes recorded the same way
  const vaultSecrets = options.vaultSecrets ?? {};
  run.vaultSecrets = vaultSecrets;
  const vaultRefusals = { ...options.vaultRefusals };
  const vaultDeleted = new Set(options.vaultDeleted ?? []);
  class SecretClient {
    constructor(private readonly url: string) {}
    private vault() {
      return this.url.replace('https://', '').replace('.vault.azure.net', '');
    }
    private key(name: string) {
      return `${this.vault()}/${name}`;
    }
    private refuse() {
      const vault = this.vault();
      if ((vaultRefusals[vault] ?? 0) > 0) {
        vaultRefusals[vault]--;
        throw Object.assign(new Error(`Forbidden: ${vault}`), {
          statusCode: 403,
        });
      }
    }
    async getSecret(name: string) {
      this.refuse();
      const key = this.key(name);
      if (!(key in vaultSecrets)) {
        throw Object.assign(new Error('SecretNotFound'), { statusCode: 404 });
      }
      return { value: vaultSecrets[key] };
    }
    async setSecret(name: string, value: string) {
      this.refuse();
      const key = this.key(name);
      if (vaultDeleted.has(key)) {
        throw Object.assign(
          new Error(
            `Secret ${name} is currently in a deleted but recoverable state, and its name cannot be reused; in this state, the secret can only be recovered or purged.`,
          ),
          { statusCode: 409 },
        );
      }
      vaultSecrets[key] = value;
      run.writes.push(key);
      run.events.push(`write ${key}`);
      return {};
    }
    async beginRecoverDeletedSecret(name: string) {
      const key = this.key(name);
      return {
        pollUntilDone: async () => {
          vaultDeleted.delete(key);
          run.events.push(`recover ${key}`);
        },
      };
    }
  }

  // pg_dump and pg_restore stand-ins: pg_dump writes its output, then
  // closes; pg_restore reads all it is given, then closes
  function spawn(
    command: string,
    args: string[],
    spawnOptions: { env: Record<string, string> },
  ) {
    const behaviour =
      options.tools?.[command as 'pg_dump' | 'pg_restore'] ?? {};
    const child = Object.assign(new EventEmitter(), {
      stdout: new stream.PassThrough(),
      stderr: new stream.PassThrough(),
      stdin: new stream.PassThrough(),
      kill: () => {
        if (!closed) setImmediate(() => child.emit('close', null));
        closed = true;
      },
    });
    let closed = false;
    const tool: ToolRun = {
      command,
      args,
      env: spawnOptions.env,
      stdin: Buffer.alloc(0),
    };
    run.tools.push(tool);
    run.events.push(`spawn ${command}`);
    const close = () => {
      if (closed) return;
      closed = true;
      setImmediate(() => child.emit('close', behaviour.exitCode ?? 0));
    };
    if (behaviour.stderr) child.stderr.write(behaviour.stderr);
    child.stderr.end();
    if (command === 'pg_dump') {
      child.stdout.on('end', close);
      child.stdout.end(Buffer.from(behaviour.output ?? 'DUMP'));
    } else {
      const chunks: Buffer[] = [];
      child.stdin.on('data', (chunk: Buffer) => chunks.push(chunk));
      child.stdin.on('end', () => {
        tool.stdin = Buffer.concat(chunks);
        close();
      });
    }
    return child;
  }

  const readFile = (key: string) => {
    if (!(key in run.files)) throw new Error(`No file ${key}`);
    return stream.Readable.from([run.files[key]]);
  };
  // Collects a stream; the file is stored only when it ends without an error
  const writeFile = (key: string) => {
    const chunks: Buffer[] = [];
    return new stream.Writable({
      write(chunk: Buffer, _encoding, callback) {
        chunks.push(Buffer.from(chunk));
        callback();
      },
      final(callback) {
        run.files[key] = Buffer.concat(chunks);
        callback();
      },
    });
  };

  // GCP: Cloud Storage
  class Storage {
    bucket(bucket: string) {
      return {
        file: (name: string) => ({
          getMetadata: async () => {
            if (!(`${bucket}/${name}` in run.files)) {
              throw Object.assign(new Error('No such object'), { code: 404 });
            }
            return [{}];
          },
          createWriteStream: () => writeFile(`${bucket}/${name}`),
          createReadStream: () => readFile(`${bucket}/${name}`),
        }),
      };
    }
  }
  // AWS: S3
  class S3Client {
    async send(command: { run: () => unknown }) {
      return command.run();
    }
  }
  class GetObjectCommand {
    constructor(readonly input: { Bucket: string; Key: string }) {}
    run() {
      return { Body: readFile(`${this.input.Bucket}/${this.input.Key}`) };
    }
  }
  class Upload {
    constructor(
      readonly upload: {
        params: { Bucket: string; Key: string; Body: stream.Readable };
      },
    ) {}
    async done() {
      const { Bucket, Key, Body } = this.upload.params;
      await streamPromises.pipeline(Body, writeFile(`${Bucket}/${Key}`));
    }
  }
  // Azure: Blob Storage
  class ContainerClient {
    constructor(private readonly url: string) {}
    getBlockBlobClient(name: string) {
      return {
        uploadStream: (body: stream.Readable) =>
          streamPromises.pipeline(body, writeFile(`${this.url}/${name}`)),
      };
    }
    getBlobClient(name: string) {
      return {
        download: async () => ({
          readableStreamBody: readFile(`${this.url}/${name}`),
        }),
      };
    }
  }

  const modules: Record<string, unknown> = {
    child_process: { spawn },
    stream,
    'stream/promises': streamPromises,
    '@google-cloud/storage': { Storage },
    '@aws-sdk/client-s3': { S3Client, GetObjectCommand },
    '@aws-sdk/lib-storage': { Upload },
    '@azure/storage-blob': { ContainerClient },
    '@azure/identity': { DefaultAzureCredential: class {} },
    '@azure/keyvault-secrets': { SecretClient },
    pg: { Client },
    '@aws-sdk/client-secrets-manager': {
      SecretsManagerClient,
      GetSecretValueCommand,
      CreateSecretCommand,
      PutSecretValueCommand,
    },
    '@google-cloud/secret-manager': { SecretManagerServiceClient },
    crypto,
  };

  const completion: unknown = vm.runInNewContext(filesFor(cloud).indexJs, {
    require: (name: string) => modules[name],
    URL,
    Buffer,
    // No real waiting between connection attempts
    setTimeout: (callback: () => void) => callback(),
    process: {
      env: {
        PROJECT: 'shop',
        ENVIRONMENT: 'dev',
        DB_HOST: 'db.internal',
        DB_MASTER_PASSWORD: 'master',
        DB_ADMIN_PASSWORD: 'admin',
        GCP_PROJECT_ID: 'gcp-shop',
        SERVICES: JSON.stringify([
          { name: 'auth-service', hasDatabase: true },
          { name: 'bff-service', hasDatabase: false },
        ]),
        ...options.env,
      },
      exit: (code: number) => {
        run.exitCode = code;
      },
    },
    console: {
      log: (message: string) => run.logs.push(message),
      error: (message: string) => run.errors.push(message),
    },
  });
  await completion;
  return run;
}

/** The tsdevstack.* settings the script set before a part of the SQL */
function settingsBefore(run: Run, part: string): string[] {
  const index = run.queries.findIndex((q) => q.sql === part);
  return run.queries[index - 1]?.params as string[];
}

const OWNER_KEY = 'auth-service-MIGRATION_DATABASE_URL';
const APP_KEY = 'auth-service-DATABASE_URL';
const ALNUM_32 = /^[A-Za-z0-9]{32}$/;

describe('generateDbInit', () => {
  describe('dockerfile and packageJson', () => {
    it("should build on the postgres image of the cloud's server, so pg_dump and pg_restore match it", () => {
      expect(filesFor('gcp').dockerfile).toContain('FROM postgres:15-alpine');
      expect(filesFor('aws').dockerfile).toContain('FROM postgres:15-alpine');
      expect(filesFor('azure').dockerfile).toContain('FROM postgres:16-alpine');
    });

    it("should add Node, skip the image's own entrypoint (it starts a server) and run index.js", () => {
      const dockerfile = filesFor('gcp').dockerfile;
      expect(dockerfile).toContain('RUN apk add --no-cache nodejs npm');
      expect(dockerfile).toContain('ENTRYPOINT []');
      expect(dockerfile).toContain('CMD ["node", "index.js"]');
    });

    it("should depend on pg and the cloud's secret and file store libraries", () => {
      const deps = (cloud: DbInitCloud) =>
        Object.keys(
          (
            JSON.parse(filesFor(cloud).packageJson) as {
              dependencies: Record<string, string>;
            }
          ).dependencies,
        ).sort();
      expect(deps('aws')).toEqual([
        '@aws-sdk/client-s3',
        '@aws-sdk/client-secrets-manager',
        '@aws-sdk/lib-storage',
        'pg',
      ]);
      expect(deps('gcp')).toEqual([
        '@google-cloud/secret-manager',
        '@google-cloud/storage',
        'pg',
      ]);
      expect(deps('azure')).toEqual([
        '@azure/identity',
        '@azure/keyvault-secrets',
        '@azure/storage-blob',
        'pg',
      ]);
    });
  });

  describe('AWS: a new environment', () => {
    it('should create the database, run both SQL parts as postgres and write both secrets', async () => {
      const run = await runScript('aws', { databaseExists: false });

      expect(run.exitCode).toBeUndefined();
      expect(run.users.every((user) => user === 'postgres')).toBe(true);
      expect(run.queries.map((q) => q.sql)).toContain(
        'CREATE DATABASE "auth-service"',
      );
      expect(
        run.queries.filter((q) => q.sql === SQL.server).map((q) => q.database),
      ).toEqual(['postgres']);
      expect(
        run.queries
          .filter((q) => q.sql === SQL.database)
          .map((q) => q.database),
      ).toEqual(['auth-service']);
      expect(run.writes).toEqual([OWNER_KEY, APP_KEY]);
    });

    it('should give the SQL the roles, the database and both passwords', async () => {
      const run = await runScript('aws');

      const params = settingsBefore(run, SQL.server);
      expect(params.slice(0, 3)).toEqual([
        'auth-service',
        'auth-service_app',
        'auth-service',
      ]);
      expect(params[3]).toMatch(ALNUM_32);
      expect(params[4]).toMatch(ALNUM_32);
      expect(params[3]).not.toBe(params[4]);
      expect(settingsBefore(run, SQL.database)).toEqual(params);
    });

    it('should write URLs with the passwords it set', async () => {
      const run = await runScript('aws');

      const [, , , ownerPassword, appPassword] = settingsBefore(
        run,
        SQL.server,
      );
      expect(run.secrets[OWNER_KEY]).toBe(
        `postgresql://auth-service:${ownerPassword}@db.internal:5432/auth-service`,
      );
      expect(run.secrets[APP_KEY]).toBe(
        `postgresql://auth-service_app:${appPassword}@db.internal:5432/auth-service`,
      );
    });

    it('should write the secrets only after the roles are in place', async () => {
      const run = await runScript('aws');

      const lastSql = Math.max(
        ...run.events.map((event, index) =>
          event.startsWith('query') ? index : -1,
        ),
      );
      const firstWrite = run.events.findIndex((e) => e.startsWith('write'));
      expect(firstWrite).toBeGreaterThan(lastSql);
    });

    it('should skip services without a database', async () => {
      const run = await runScript('aws');

      expect(run.queries.some((q) => q.sql.includes('bff-service'))).toBe(
        false,
      );
    });
  });

  describe('AWS: an environment from before the app role', () => {
    const before = {
      [APP_KEY]:
        'postgresql://auth-service:owner-pw@db.internal:5432/auth-service',
    };

    it("should keep the owner's password from DATABASE_URL", async () => {
      const run = await runScript('aws', { secrets: before });

      expect(settingsBefore(run, SQL.server)[3]).toBe('owner-pw');
      expect(run.secrets[OWNER_KEY]).toBe(
        'postgresql://auth-service:owner-pw@db.internal:5432/auth-service',
      );
    });

    it('should turn DATABASE_URL into the app role with a new password', async () => {
      const run = await runScript('aws', { secrets: before });

      const appPassword = settingsBefore(run, SQL.server)[4];
      expect(appPassword).not.toBe('owner-pw');
      expect(run.secrets[APP_KEY]).toBe(
        `postgresql://auth-service_app:${appPassword}@db.internal:5432/auth-service`,
      );
    });
  });

  describe('AWS: later deploys', () => {
    const converted = {
      [OWNER_KEY]:
        'postgresql://auth-service:owner-pw@db.internal:5432/auth-service',
      [APP_KEY]:
        'postgresql://auth-service_app:app-pw@db.internal:5432/auth-service',
    };

    it('should keep both passwords and write no secret', async () => {
      const run = await runScript('aws', { secrets: converted });

      expect(settingsBefore(run, SQL.server).slice(3)).toEqual([
        'owner-pw',
        'app-pw',
      ]);
      expect(run.writes).toEqual([]);
    });

    it('should give the app role a new password when its secret is gone', async () => {
      const run = await runScript('aws', {
        secrets: { [OWNER_KEY]: converted[OWNER_KEY] },
      });

      expect(run.writes).toEqual([APP_KEY]);
      expect(settingsBefore(run, SQL.server)[3]).toBe('owner-pw');
    });

    it('should decode a URL-encoded password', async () => {
      const run = await runScript('aws', {
        secrets: {
          ...converted,
          [APP_KEY]:
            'postgresql://auth-service_app:a%2Fb@db.internal:5432/auth-service',
        },
      });

      expect(settingsBefore(run, SQL.server)[4]).toBe('a/b');
      expect(run.writes).toEqual([]);
    });
  });

  describe("GCP: the owner is Terraform's", () => {
    const before = {
      [APP_KEY]:
        'postgresql://auth-service:terraform-pw@10.0.0.3:5432/auth-service',
    };

    it("should leave the owner's password and MIGRATION_DATABASE_URL to the CLI", async () => {
      const run = await runScript('gcp', { secrets: before });

      expect(settingsBefore(run, SQL.server)[3]).toBe('');
      expect(run.writes).toEqual([APP_KEY]);
    });

    it('should log in as postgres with DB_ADMIN_PASSWORD and never create the database', async () => {
      const run = await runScript('gcp', { databaseExists: false });

      expect(run.users.every((user) => user === 'postgres')).toBe(true);
      expect(run.queries.some((q) => q.sql.startsWith('CREATE DATABASE'))).toBe(
        false,
      );
    });

    it('should move DATABASE_URL to the app role in the GCP project', async () => {
      const run = await runScript('gcp', { secrets: before });

      const appPassword = settingsBefore(run, SQL.server)[4];
      expect(appPassword).toMatch(ALNUM_32);
      expect(run.secrets[APP_KEY]).toBe(
        `postgresql://auth-service_app:${appPassword}@db.internal:5432/auth-service`,
      );
    });

    it('should write nothing on later deploys', async () => {
      const run = await runScript('gcp', {
        secrets: {
          [APP_KEY]:
            'postgresql://auth-service_app:app-pw@db.internal:5432/auth-service',
        },
      });

      expect(run.writes).toEqual([]);
      expect(settingsBefore(run, SQL.server)[4]).toBe('app-pw');
    });
  });

  describe('Azure: services connected as the server admin', () => {
    const azureEnv = {
      DB_ADMIN_USER: 'tsdevstack',
      DB_JOBS_KEY_VAULT: 'shop-dev-dbjobs',
      DB_ADMIN_PASSWORD_SECRET: 'db-admin-password',
      KEY_VAULTS: JSON.stringify({ 'auth-service': 'shop-dev-auth-service' }),
    };
    const adminUrl =
      'postgresql://tsdevstack:admin-pw@shop.postgres.database.azure.com:5432/auth-service?sslmode=require';

    it('should log in as the server admin with the password from the database jobs vault', async () => {
      const run = await runScript('azure', {
        env: azureEnv,
        vaultSecrets: {
          'shop-dev-dbjobs/db-admin-password': 'admin-pw',
          'shop-dev-auth-service/shop-auth-service-DATABASE-URL': adminUrl,
        },
      });

      expect(run.exitCode).toBeUndefined();
      expect(run.users.every((user) => user === 'tsdevstack')).toBe(true);
      expect(run.queries.some((q) => q.sql.startsWith('CREATE DATABASE'))).toBe(
        false,
      );
    });

    it("should give the owner a new password, kept where services can't read it", async () => {
      const run = await runScript('azure', {
        env: azureEnv,
        vaultSecrets: {
          'shop-dev-dbjobs/db-admin-password': 'admin-pw',
          'shop-dev-auth-service/shop-auth-service-DATABASE-URL': adminUrl,
        },
      });

      const [, , , ownerPassword, appPassword] = settingsBefore(
        run,
        SQL.server,
      );
      expect(ownerPassword).toMatch(ALNUM_32);
      expect(run.writes).toEqual([
        'shop-dev-dbjobs/shop-auth-service-MIGRATION-DATABASE-URL',
        'shop-dev-auth-service/shop-auth-service-DATABASE-URL',
      ]);
      expect(
        run.vaultSecrets?.[
          'shop-dev-dbjobs/shop-auth-service-MIGRATION-DATABASE-URL'
        ],
      ).toBe(
        `postgresql://auth-service:${ownerPassword}@db.internal:5432/auth-service?sslmode=require`,
      );
      expect(
        run.vaultSecrets?.[
          'shop-dev-auth-service/shop-auth-service-DATABASE-URL'
        ],
      ).toBe(
        `postgresql://auth-service_app:${appPassword}@db.internal:5432/auth-service?sslmode=require`,
      );
    });

    it('should write nothing on later deploys', async () => {
      const run = await runScript('azure', {
        env: azureEnv,
        vaultSecrets: {
          'shop-dev-dbjobs/db-admin-password': 'admin-pw',
          'shop-dev-dbjobs/shop-auth-service-MIGRATION-DATABASE-URL':
            'postgresql://auth-service:o@db.internal:5432/auth-service?sslmode=require',
          'shop-dev-auth-service/shop-auth-service-DATABASE-URL':
            'postgresql://auth-service_app:a@db.internal:5432/auth-service?sslmode=require',
        },
      });

      expect(settingsBefore(run, SQL.server).slice(3)).toEqual(['o', 'a']);
      expect(run.writes).toEqual([]);
    });

    it('should stop when the admin password is not in the vault', async () => {
      const run = await runScript('azure', { env: azureEnv });

      expect(run.exitCode).toBe(1);
      expect(run.errors).toEqual([
        'Missing the admin password (DB_ADMIN_PASSWORD_SECRET in DB_JOBS_KEY_VAULT)',
      ]);
      expect(run.queries).toEqual([]);
    });

    it("should wait while a vault refuses the job's new role (403)", async () => {
      const run = await runScript('azure', {
        env: azureEnv,
        vaultSecrets: {
          'shop-dev-dbjobs/db-admin-password': 'admin-pw',
          'shop-dev-auth-service/shop-auth-service-DATABASE-URL': adminUrl,
        },
        vaultRefusals: { 'shop-dev-dbjobs': 3, 'shop-dev-auth-service': 2 },
      });

      expect(run.exitCode).toBeUndefined();
      expect(run.errors).toEqual([]);
      expect(run.writes).toEqual([
        'shop-dev-dbjobs/shop-auth-service-MIGRATION-DATABASE-URL',
        'shop-dev-auth-service/shop-auth-service-DATABASE-URL',
      ]);
    });

    it('should recover a deleted secret that holds the name, then write it', async () => {
      const run = await runScript('azure', {
        env: azureEnv,
        vaultSecrets: {
          'shop-dev-dbjobs/db-admin-password': 'admin-pw',
          'shop-dev-auth-service/shop-auth-service-DATABASE-URL': adminUrl,
        },
        // remove-service deleted the owner's URL
        vaultDeleted: [
          'shop-dev-dbjobs/shop-auth-service-MIGRATION-DATABASE-URL',
        ],
      });

      expect(run.exitCode).toBeUndefined();
      expect(run.errors).toEqual([]);
      expect(
        run.events.filter((event) => /^(recover|write) /.test(event)),
      ).toEqual([
        'recover shop-dev-dbjobs/shop-auth-service-MIGRATION-DATABASE-URL',
        'write shop-dev-dbjobs/shop-auth-service-MIGRATION-DATABASE-URL',
        'write shop-dev-auth-service/shop-auth-service-DATABASE-URL',
      ]);
      expect(run.logs).toContain(
        '  shop-auth-service-MIGRATION-DATABASE-URL was deleted; recovering it to write the new value',
      );
    });

    it('should give up after 20 refused attempts', async () => {
      const run = await runScript('azure', {
        env: azureEnv,
        vaultSecrets: { 'shop-dev-dbjobs/db-admin-password': 'admin-pw' },
        vaultRefusals: { 'shop-dev-dbjobs': 20 },
      });

      expect(run.exitCode).toBe(1);
      expect(run.errors).toEqual([
        'db-init failed: Forbidden: shop-dev-dbjobs',
      ]);
      expect(run.queries).toEqual([]);
    });
  });

  describe('MODE=remove', () => {
    it('should drop both roles of each listed service, and nothing else', async () => {
      const run = await runScript('gcp', {
        env: { MODE: 'remove', SERVICES: JSON.stringify(['auth-service']) },
        roles: ['auth-service', 'auth-service_app'],
      });

      expect(run.exitCode).toBeUndefined();
      expect(
        run.queries.filter((q) => q.sql.startsWith('DROP')).map((q) => q.sql),
      ).toEqual([
        'DROP DATABASE IF EXISTS "auth-service"',
        'DROP ROLE "auth-service"',
        'DROP ROLE "auth-service_app"',
      ]);
      expect(run.queries.some((q) => q.sql === SQL.server)).toBe(false);
      expect(run.writes).toEqual([]);
    });

    it("should close the database's connections before dropping it (in SQL: Cloud SQL's API refuses a database its admin group doesn't own)", async () => {
      const run = await runScript('gcp', {
        env: { MODE: 'remove', SERVICES: JSON.stringify(['auth-service']) },
        roles: ['auth-service', 'auth-service_app'],
      });

      const sqls = run.queries.map((q) => q.sql);
      const terminates = run.queries
        .map((q, index) => ({ ...q, index }))
        .filter((q) => q.sql.startsWith('SELECT pg_terminate_backend'));
      // One role at a time: a refusal for one role doesn't keep the other's open
      expect(terminates.map((q) => q.params)).toEqual([
        ['auth-service', 'auth-service'],
        ['auth-service', 'auth-service_app'],
      ]);
      for (const terminate of terminates) {
        expect(terminate.index).toBeLessThan(
          sqls.indexOf('DROP DATABASE IF EXISTS "auth-service"'),
        );
      }
    });

    it('should still drop the database when closing connections is refused', async () => {
      const run = await runScript('gcp', {
        env: { MODE: 'remove', SERVICES: JSON.stringify(['auth-service']) },
        roles: ['auth-service', 'auth-service_app'],
        failOn: {
          sql: 'SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND usename = $2 AND pid <> pg_backend_pid()',
          error: new Error('permission denied to terminate process'),
        },
      });

      expect(run.exitCode).toBeUndefined();
      expect(
        run.queries.filter((q) => q.sql.startsWith('DROP')).map((q) => q.sql),
      ).toEqual([
        'DROP DATABASE IF EXISTS "auth-service"',
        'DROP ROLE "auth-service"',
        'DROP ROLE "auth-service_app"',
      ]);
    });

    it('should skip a database and a role that are already gone', async () => {
      const run = await runScript('gcp', {
        env: { MODE: 'remove', SERVICES: JSON.stringify(['auth-service']) },
        roles: ['auth-service_app'],
        databaseExists: false,
      });

      expect(
        run.queries.filter((q) => q.sql.startsWith('DROP')).map((q) => q.sql),
      ).toEqual(['DROP ROLE "auth-service_app"']);
    });

    it('should refuse an unknown mode', async () => {
      const run = await runScript('gcp', { env: { MODE: 'reset' } });

      expect(run.exitCode).toBe(1);
      expect(run.queries).toEqual([]);
    });
  });

  describe('MODE=export and MODE=restore', () => {
    const FILE = 'auth-service/2026-11-14T12-30-00Z-removed.dump';
    const BUCKET = 'shop-db-exports';
    const CONTAINER = 'https://shopdev.blob.core.windows.net/db-exports';
    const azureEnv = {
      DB_ADMIN_USER: 'tsdevstack',
      DB_JOBS_KEY_VAULT: 'shop-dev-dbjobs',
      DB_ADMIN_PASSWORD_SECRET: 'db-admin-password',
    };
    const azureVault = { 'shop-dev-dbjobs/db-admin-password': 'admin-pw' };
    const env = (mode: string, extra: Record<string, string> = {}) => ({
      MODE: mode,
      SERVICES: JSON.stringify(['auth-service']),
      EXPORT_FILE: FILE,
      EXPORT_BUCKET: BUCKET,
      EXPORT_CONTAINER_URL: CONTAINER,
      ...extra,
    });
    const stores: [DbInitCloud, string][] = [
      ['gcp', BUCKET],
      ['aws', BUCKET],
      ['azure', CONTAINER],
    ];
    const cloudOptions = (cloud: DbInitCloud) =>
      cloud === 'azure' ? { vaultSecrets: { ...azureVault } } : {};

    describe('export', () => {
      for (const [cloud, store] of stores) {
        it(`should save pg_dump's output in the file store (${cloud})`, async () => {
          const run = await runScript(cloud, {
            ...cloudOptions(cloud),
            env: { ...env('export'), ...(cloud === 'azure' ? azureEnv : {}) },
            tools: { pg_dump: { output: 'the database' } },
          });

          expect(run.errors).toEqual([]);
          expect(run.exitCode).toBeUndefined();
          expect(run.files[`${store}/${FILE}`]?.toString()).toBe(
            'the database',
          );
        });
      }

      it('should run pg_dump as the admin, in custom format, without owners or rights', async () => {
        const run = await runScript('gcp', { env: env('export') });

        const dump = run.tools.find((t) => t.command === 'pg_dump');
        expect(dump?.args).toEqual([
          '--format=custom',
          '--no-owner',
          '--no-acl',
          '--dbname',
          'auth-service',
        ]);
        expect(dump?.env).toMatchObject({
          PGHOST: 'db.internal',
          PGPORT: '5432',
          PGUSER: 'postgres',
          PGPASSWORD: 'admin',
          PGSSLMODE: 'require',
        });
      });

      it("should leave no file when pg_dump fails, and fail with pg_dump's message", async () => {
        const run = await runScript('gcp', {
          env: env('export'),
          tools: {
            pg_dump: {
              output: 'half a database',
              exitCode: 1,
              stderr: 'pg_dump: error: permission denied for table x\n',
            },
          },
        });

        expect(run.files).toEqual({});
        expect(run.exitCode).toBe(1);
        expect(run.errors.join('\n')).toContain(
          'pg_dump failed (exit 1): pg_dump: error: permission denied for table x',
        );
      });

      it('should fail when the service has no database', async () => {
        const run = await runScript('gcp', {
          env: env('export'),
          databaseExists: false,
        });

        expect(run.exitCode).toBe(1);
        expect(run.errors.join('\n')).toContain('No database auth-service');
        expect(run.tools).toEqual([]);
      });

      it('should need EXPORT_FILE and exactly one service', async () => {
        const noFile = await runScript('gcp', {
          env: env('export', { EXPORT_FILE: '' }),
        });
        const twoServices = await runScript('gcp', {
          env: env('export', {
            SERVICES: JSON.stringify(['auth-service', 'offers-service']),
          }),
        });

        for (const run of [noFile, twoServices]) {
          expect(run.exitCode).toBe(1);
          expect(run.tools).toEqual([]);
        }
      });
    });

    describe('restore', () => {
      const files = (store: string) => ({
        [`${store}/${FILE}`]: 'the saved database',
      });
      const postgresSql = (run: Run) =>
        run.queries.filter((q) => q.database === 'postgres').map((q) => q.sql);

      for (const [cloud, store] of stores) {
        it(`should give pg_restore the file from the file store (${cloud})`, async () => {
          const run = await runScript(cloud, {
            ...cloudOptions(cloud),
            env: {
              ...env('restore'),
              ...(cloud === 'azure' ? azureEnv : {}),
            },
            files: files(store),
          });

          expect(run.errors).toEqual([]);
          expect(run.exitCode).toBeUndefined();
          const restore = run.tools.find((t) => t.command === 'pg_restore');
          expect(restore?.stdin.toString()).toBe('the saved database');
        });
      }

      it('should restore as the admin in one transaction, without owners or rights', async () => {
        const run = await runScript('gcp', {
          env: env('restore'),
          files: files(BUCKET),
        });

        const restore = run.tools.find((t) => t.command === 'pg_restore');
        expect(restore?.args).toEqual([
          '--no-owner',
          '--no-acl',
          '--single-transaction',
          '--exit-on-error',
          '--dbname',
          'auth-service',
        ]);
        expect(restore?.env).toMatchObject({
          PGUSER: 'postgres',
          PGPASSWORD: 'admin',
        });
      });

      it('should make the database again, empty, with its encoding and collation, owned by the owner', async () => {
        const run = await runScript('gcp', {
          env: env('restore'),
          files: files(BUCKET),
        });

        expect(postgresSql(run)).toContain('DROP DATABASE "auth-service"');
        expect(postgresSql(run)).toContain(
          `CREATE DATABASE "auth-service" OWNER "auth-service" TEMPLATE template0 ENCODING 'UTF8' LC_COLLATE 'en_US.UTF8' LC_CTYPE 'en_US.UTF8'`,
        );
      });

      it('should keep the service out from before the drop until the rights are back', async () => {
        const run = await runScript('gcp', {
          env: env('restore'),
          files: files(BUCKET),
        });

        const at = (prefix: string) =>
          run.events.findIndex((e) => e.includes(prefix));
        const order = [
          'query postgres: REVOKE CONNECT ON DATABASE "auth-serv',
          'query postgres: GRANT "auth-service_app" TO current_us',
          'query postgres: SELECT pg_terminate_backend',
          'query postgres: DROP DATABASE',
          'query postgres: CREATE DATABASE',
          'query postgres: REVOKE ALL ON DATABASE',
          'spawn pg_restore',
          'query auth-service: -- database part',
          'query postgres: -- server part',
        ].map(at);
        expect(order.every((index) => index >= 0)).toBe(true);
        expect([...order].sort((a, b) => a - b)).toEqual(order);
        // Both roles' connections are closed
        const terminated = run.queries
          .filter((q) => q.sql.startsWith('SELECT pg_terminate_backend'))
          .map((q) => q.params?.[1]);
        expect(terminated).toEqual(['auth-service', 'auth-service_app']);
      });

      it("should not grant the app role's rights again when the admin has them", async () => {
        const run = await runScript('gcp', {
          env: env('restore'),
          files: files(BUCKET),
          adminInApp: true,
        });

        expect(postgresSql(run)).not.toContain(
          'GRANT "auth-service_app" TO current_user',
        );
        expect(run.errors).toEqual([]);
      });

      it('should give everything to the owner and the app role its rights afterwards, keeping the passwords', async () => {
        const run = await runScript('gcp', {
          env: env('restore'),
          files: files(BUCKET),
        });

        const databasePart = run.queries.find((q) => q.sql === SQL.database);
        expect(databasePart?.database).toBe('auth-service');
        expect(settingsBefore(run, SQL.database)).toEqual([
          'auth-service',
          'auth-service_app',
          'auth-service',
          '',
          '',
        ]);
        expect(settingsBefore(run, SQL.server)).toEqual([
          'auth-service',
          'auth-service_app',
          'auth-service',
          '',
          '',
        ]);
        expect(run.writes).toEqual([]);
      });

      it('should try the drop again while a connection is still open', async () => {
        const run = await runScript('gcp', {
          env: env('restore'),
          files: files(BUCKET),
          failOn: {
            sql: 'DROP DATABASE "auth-service"',
            error: Object.assign(
              new Error(
                'database "auth-service" is being accessed by other users',
              ),
              { code: '55006' },
            ),
            times: 2,
          },
        });

        expect(run.errors).toEqual([]);
        expect(
          postgresSql(run).filter(
            (sql) => sql === 'DROP DATABASE "auth-service"',
          ),
        ).toHaveLength(3);
      });

      it("should stop with pg_restore's message before the rights when it fails", async () => {
        const run = await runScript('gcp', {
          env: env('restore'),
          files: files(BUCKET),
          tools: {
            pg_restore: {
              exitCode: 1,
              stderr: 'pg_restore: error: could not execute query\n',
            },
          },
        });

        expect(run.exitCode).toBe(1);
        expect(run.errors.join('\n')).toContain(
          'pg_restore failed (exit 1): pg_restore: error: could not execute query',
        );
        expect(run.queries.some((q) => q.sql === SQL.database)).toBe(false);
      });

      it('should change nothing when the file is missing', async () => {
        const run = await runScript('gcp', { env: env('restore') });

        expect(run.exitCode).toBe(1);
        expect(postgresSql(run).some((sql) => sql.startsWith('REVOKE'))).toBe(
          false,
        );
        expect(postgresSql(run).some((sql) => sql.startsWith('DROP'))).toBe(
          false,
        );
      });

      it('should change nothing when the service has no database', async () => {
        const run = await runScript('gcp', {
          env: env('restore'),
          files: files(BUCKET),
          databaseExists: false,
        });

        expect(run.exitCode).toBe(1);
        expect(run.errors.join('\n')).toContain(
          'No database auth-service: deploy the service first',
        );
        expect(postgresSql(run).some((sql) => sql.startsWith('DROP'))).toBe(
          false,
        );
      });
    });
  });

  describe('Connecting right after Terraform', () => {
    it('should retry while the database does not take connections yet', async () => {
      const run = await runScript('gcp', {
        connectFailures: { count: 2, code: 'ECONNREFUSED' },
      });

      expect(run.exitCode).toBeUndefined();
      expect(run.queries.some((q) => q.sql === SQL.server)).toBe(true);
    });

    it('should give up after six attempts', async () => {
      const run = await runScript('gcp', {
        connectFailures: { count: 6, code: '57P03' },
      });

      expect(run.exitCode).toBe(1);
      expect(run.errors).toEqual(['db-init failed: connect failed']);
    });

    it('should not retry a wrong password', async () => {
      const run = await runScript('gcp', {
        connectFailures: { count: 1, code: '28P01' },
      });

      expect(run.exitCode).toBe(1);
      expect(run.queries).toEqual([]);
    });
  });

  describe('Failures', () => {
    it("should print only the error's message (a statement's context can hold a password)", async () => {
      const error = Object.assign(
        new Error('permission denied to create role'),
        { where: 'SQL statement "ALTER ROLE x PASSWORD \'secret-pw\'"' },
      );

      const run = await runScript('aws', {
        failOn: { sql: SQL.server, error },
      });

      expect(run.exitCode).toBe(1);
      expect(run.errors).toEqual([
        'db-init failed: permission denied to create role',
      ]);
      expect(run.writes).toEqual([]);
    });

    it('should stop when a required variable is missing', async () => {
      const run = await runScript('gcp', { env: { DB_ADMIN_PASSWORD: '' } });

      expect(run.exitCode).toBe(1);
      expect(run.queries).toEqual([]);
    });
  });

  describe('The SQL', () => {
    it('should embed both parts of the shared SQL as they are', () => {
      const sql = { server: "SELECT 'a\nb' AS x; -- `$x`", database: 'x"y' };
      const { indexJs } = generateDbInit({
        cloud: 'gcp',
        sql,
        appRoleSuffix: '_app',
      });

      expect(indexJs).toContain(
        `const SERVER_SQL = ${JSON.stringify(sql.server)};`,
      );
      expect(indexJs).toContain(
        `const DATABASE_SQL = ${JSON.stringify(sql.database)};`,
      );
    });
  });
});
