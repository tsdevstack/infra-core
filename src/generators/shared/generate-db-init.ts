/**
 * Generate the db-init job's files (every cloud)
 *
 * Generates:
 * - Dockerfile - the postgres image of the server's version, with Node
 * - package.json - pg, the cloud's secret store and file store libraries
 * - index.js - sets up each service's two database roles and their URL
 *   secrets (MODE=init, the default), drops the database and the roles of
 *   removed services (MODE=remove), saves a service's database to a file
 *   (MODE=export) or replaces it with one (MODE=restore)
 *
 * The files go to infrastructure/terraform/{env}/db-init/ and are built into
 * an image at deploy time. The SQL is the CLI's db-init SQL, the same
 * locally and on every cloud; only the secret store, the file store, the
 * admin login and who owns the owner role's password differ per cloud.
 */

import { DB_SERVER_POSTGRES_VERSION } from '../../constants/database-export.ts';

/** Clouds the db-init job runs on */
export type DbInitCloud = 'aws' | 'gcp' | 'azure';

export interface DbInitFiles {
  dockerfile: string;
  packageJson: string;
  indexJs: string;
}

export interface GenerateDbInitOptions {
  cloud: DbInitCloud;
  /** The shared db-init SQL (the CLI's templates/db-init) */
  sql: {
    /** Run in the maintenance database: roles, passwords, who connects */
    server: string;
    /** Run in the service's database: ownership, the app role's rights */
    database: string;
  };
  /** Suffix of the app role ({service}_app) */
  appRoleSuffix: string;
}

/** What differs per cloud */
interface DbInitProfile {
  dependencies: Record<string, string>;
  /** Body of readAdminPassword(): the admin login's password */
  readAdminPassword: string;
  /** Where that password comes from (named when it's missing) */
  adminPasswordSource: string;
  /** The job creates a missing database (elsewhere Terraform does) */
  createsDatabase: boolean;
  /**
   * The job sets the owner's password and writes MIGRATION_DATABASE_URL.
   * On GCP the owner is Terraform's (google_sql_user): its password and that
   * secret are left to the CLI.
   */
  managesOwner: boolean;
  /** Appended to the URLs it writes */
  urlQuery: string;
  /** Defines readSecret(scope, key) and writeSecret(scope, key, value) */
  secretStore: string;
  /**
   * Defines uploadFile(name, body) and downloadFile(name): the saved
   * databases (MODE=export, MODE=restore), streamed
   */
  fileStore: string;
}

const PROFILES: Record<DbInitCloud, DbInitProfile> = {
  aws: {
    dependencies: {
      pg: '^8.11.0',
      '@aws-sdk/client-secrets-manager': '^3.700.0',
      '@aws-sdk/client-s3': '^3.1006.0',
      '@aws-sdk/lib-storage': '^3.1006.0',
    },
    readAdminPassword: 'return process.env.DB_MASTER_PASSWORD;',
    adminPasswordSource: 'DB_MASTER_PASSWORD',
    createsDatabase: true,
    managesOwner: true,
    urlQuery: '',
    secretStore: `// Secrets Manager: {project}-{scope}-{KEY}
const {
  SecretsManagerClient,
  CreateSecretCommand,
  PutSecretValueCommand,
  GetSecretValueCommand,
} = require('@aws-sdk/client-secrets-manager');

const secretsClient = new SecretsManagerClient({
  region: process.env.AWS_REGION,
});

function secretName(scope, key) {
  return process.env.PROJECT + '-' + scope + '-' + key;
}

async function readSecret(scope, key) {
  try {
    const result = await secretsClient.send(
      new GetSecretValueCommand({ SecretId: secretName(scope, key) })
    );
    return result.SecretString || null;
  } catch (e) {
    if (e.name === 'ResourceNotFoundException') return null;
    throw e;
  }
}

async function writeSecret(scope, key, value) {
  const name = secretName(scope, key);
  try {
    await secretsClient.send(
      new CreateSecretCommand({
        Name: name,
        SecretString: value,
        Tags: [
          { Key: 'managed-by', Value: 'tsdevstack' },
          { Key: 'project', Value: process.env.PROJECT },
          { Key: 'environment', Value: process.env.ENVIRONMENT },
          { Key: 'secret-type', Value: 'database-url' },
        ],
      })
    );
  } catch (e) {
    if (e.name === 'ResourceExistsException') {
      await secretsClient.send(
        new PutSecretValueCommand({ SecretId: name, SecretString: value })
      );
    } else {
      throw e;
    }
  }
}`,
    fileStore: `// Saved databases: an S3 bucket (EXPORT_BUCKET), as a multipart upload. A
// stream that fails aborts the upload, so no file is left.
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');

const s3Client = new S3Client({ region: process.env.AWS_REGION });

function exportBucket() {
  if (!process.env.EXPORT_BUCKET) throw new Error('Missing EXPORT_BUCKET');
  return process.env.EXPORT_BUCKET;
}

async function uploadFile(name, body) {
  await new Upload({
    client: s3Client,
    params: {
      Bucket: exportBucket(),
      Key: name,
      Body: body,
      ContentType: 'application/octet-stream',
    },
  }).done();
}

async function downloadFile(name) {
  const response = await s3Client.send(
    new GetObjectCommand({ Bucket: exportBucket(), Key: name })
  );
  return response.Body;
}`,
  },
  gcp: {
    dependencies: {
      pg: '^8.11.0',
      '@google-cloud/secret-manager': '^7.2.0',
      '@google-cloud/storage': '^8.4.0',
    },
    readAdminPassword: 'return process.env.DB_ADMIN_PASSWORD;',
    adminPasswordSource: 'DB_ADMIN_PASSWORD',
    createsDatabase: false,
    managesOwner: false,
    urlQuery: '',
    secretStore: `// Secret Manager: projects/{GCP_PROJECT_ID}/secrets/{project}-{scope}-{KEY}.
// The CLI creates the secrets before the job runs; the job adds versions.
const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');

const secretsClient = new SecretManagerServiceClient();

function secretName(scope, key) {
  return (
    'projects/' + process.env.GCP_PROJECT_ID + '/secrets/' +
    process.env.PROJECT + '-' + scope + '-' + key
  );
}

async function readSecret(scope, key) {
  try {
    const [version] = await secretsClient.accessSecretVersion({
      name: secretName(scope, key) + '/versions/latest',
    });
    return version.payload.data.toString('utf8');
  } catch (e) {
    // NOT_FOUND: no secret, or a secret without versions yet
    if (e.code === 5) return null;
    throw e;
  }
}

async function writeSecret(scope, key, value) {
  await secretsClient.addSecretVersion({
    parent: secretName(scope, key),
    payload: { data: Buffer.from(value, 'utf8') },
  });
}`,
    fileStore: `// Saved databases: a Cloud Storage bucket (EXPORT_BUCKET), as a resumable
// upload. A stream that fails never completes the upload, so no file is left.
const { Storage } = require('@google-cloud/storage');

const storage = new Storage();

function exportBucket() {
  if (!process.env.EXPORT_BUCKET) throw new Error('Missing EXPORT_BUCKET');
  return storage.bucket(process.env.EXPORT_BUCKET);
}

async function uploadFile(name, body) {
  await pipeline(
    body,
    exportBucket()
      .file(name)
      .createWriteStream({ resumable: true, contentType: 'application/octet-stream' })
  );
}

async function downloadFile(name) {
  const file = exportBucket().file(name);
  // A missing file fails here, before the restore changes anything (the
  // download itself starts only when read)
  await file.getMetadata();
  return file.createReadStream();
}`,
  },
  azure: {
    dependencies: {
      pg: '^8.11.0',
      '@azure/identity': '^4.14.0',
      '@azure/keyvault-secrets': '^4.10.0',
      '@azure/storage-blob': '^12.31.0',
    },
    readAdminPassword:
      'return readVaultSecret(process.env.DB_JOBS_KEY_VAULT, process.env.DB_ADMIN_PASSWORD_SECRET);',
    adminPasswordSource: 'DB_ADMIN_PASSWORD_SECRET in DB_JOBS_KEY_VAULT',
    createsDatabase: false,
    managesOwner: true,
    urlQuery: '?sslmode=require',
    secretStore: `// Key Vault: DATABASE_URL in the service's own vault (KEY_VAULTS maps each
// service to it), MIGRATION_DATABASE_URL and the admin password in the
// database jobs' vault (DB_JOBS_KEY_VAULT), which services can't read.
// Names are {project}-{scope}-{KEY} with hyphens for underscores. The job
// runs as the database jobs' identity (AZURE_CLIENT_ID).
const { DefaultAzureCredential } = require('@azure/identity');
const { SecretClient } = require('@azure/keyvault-secrets');

const credential = new DefaultAzureCredential();
const vaultClients = {};

function vaultClient(vault) {
  if (!vault) throw new Error('No Key Vault given');
  if (!vaultClients[vault]) {
    vaultClients[vault] = new SecretClient('https://' + vault + '.vault.azure.net', credential);
  }
  return vaultClients[vault];
}

// Terraform grants this identity its Key Vault roles just before the job
// runs, and a new role takes a few minutes to apply: a refused request (403)
// is retried for up to 5 minutes
const VAULT_RETRY_ATTEMPTS = 20;
const VAULT_RETRY_DELAY_MS = 15000;

async function withVaultAccess(vault, action) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await action(vaultClient(vault));
    } catch (e) {
      if (e.statusCode !== 403 || attempt >= VAULT_RETRY_ATTEMPTS) throw e;
      console.log(
        '  Key Vault ' + vault + ' refused access (403), waiting for the role to apply (' +
          attempt + '/' + VAULT_RETRY_ATTEMPTS + ')'
      );
      await new Promise((resolve) => setTimeout(resolve, VAULT_RETRY_DELAY_MS));
    }
  }
}

async function readVaultSecret(vault, name) {
  try {
    const secret = await withVaultAccess(vault, (client) => client.getSecret(name));
    return secret.value || null;
  } catch (e) {
    if (e.statusCode === 404) return null;
    throw e;
  }
}

function locate(scope, key) {
  const vault =
    key === 'MIGRATION_DATABASE_URL'
      ? process.env.DB_JOBS_KEY_VAULT
      : JSON.parse(process.env.KEY_VAULTS || '{}')[scope];
  if (!vault) throw new Error('No Key Vault for ' + scope);
  return {
    vault,
    name: (process.env.PROJECT + '-' + scope + '-' + key).replace(/_/g, '-'),
  };
}

async function readSecret(scope, key) {
  const { vault, name } = locate(scope, key);
  return readVaultSecret(vault, name);
}

// A deleted secret keeps its name until recovered or purged (soft delete,
// e.g. after remove-service): recovered here, then given the new value
function isDeletedSecretConflict(e) {
  return (
    e.statusCode === 409 &&
    /deleted but recoverable|ObjectIsDeletedButRecoverable/i.test(e.message || '')
  );
}

async function writeSecret(scope, key, value) {
  const { vault, name } = locate(scope, key);
  await withVaultAccess(vault, async (client) => {
    try {
      await client.setSecret(name, value);
    } catch (e) {
      if (!isDeletedSecretConflict(e)) throw e;
      console.log('  ' + name + ' was deleted; recovering it to write the new value');
      await (await client.beginRecoverDeletedSecret(name)).pollUntilDone();
      await client.setSecret(name, value);
    }
  });
}`,
    fileStore: `// Saved databases: a Blob Storage container (EXPORT_CONTAINER_URL), as the
// database jobs' identity. A stream that fails never commits the blob, so no
// file is left.
const { ContainerClient } = require('@azure/storage-blob');

function exportContainer() {
  if (!process.env.EXPORT_CONTAINER_URL) throw new Error('Missing EXPORT_CONTAINER_URL');
  return new ContainerClient(process.env.EXPORT_CONTAINER_URL, credential);
}

async function uploadFile(name, body) {
  await exportContainer()
    .getBlockBlobClient(name)
    .uploadStream(body, 4 * 1024 * 1024, 4, {
      blobHTTPHeaders: { blobContentType: 'application/octet-stream' },
    });
}

async function downloadFile(name) {
  const response = await exportContainer().getBlobClient(name).download();
  return response.readableStreamBody;
}`,
  },
};

export function generateDbInit(options: GenerateDbInitOptions): DbInitFiles {
  const profile = PROFILES[options.cloud];
  return {
    dockerfile: generateDockerfile(options.cloud),
    packageJson: `${JSON.stringify(
      {
        name: 'db-init',
        version: '1.0.0',
        private: true,
        dependencies: profile.dependencies,
      },
      null,
      2,
    )}\n`,
    indexJs: generateIndexJs(options, profile),
  };
}

// The official postgres image of the server's version: its pg_dump and
// pg_restore (MODE=export, MODE=restore) match the server. Node comes from
// Alpine. ENTRYPOINT [] skips the image's entrypoint, which starts a server.
function generateDockerfile(cloud: DbInitCloud): string {
  return `FROM postgres:${DB_SERVER_POSTGRES_VERSION[cloud]}-alpine
RUN apk add --no-cache nodejs npm
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY index.js ./
ENTRYPOINT []
CMD ["node", "index.js"]
`;
}

function generateIndexJs(
  options: GenerateDbInitOptions,
  profile: DbInitProfile,
): string {
  return `// DB-Init Script (${options.cloud})
// Generated by: npx tsdevstack infra:generate
//
// MODE=init (default): sets up the two Postgres roles of each service with a
// database and keeps their URLs in the cloud's secret store:
// - the owner ({service}): owns the tables, used only by migrations;
//   MIGRATION_DATABASE_URL${profile.managesOwner ? '' : " (written by the CLI here: the owner is Terraform's)"}
// - the app role ({service}${options.appRoleSuffix}): the running service reads and
//   writes rows; DATABASE_URL
// MODE=remove: drops the database and the two roles of each service in
// SERVICES.
// MODE=export: saves the database of the one service in SERVICES to
// EXPORT_FILE in the file store (pg_dump's custom format).
// MODE=restore: replaces that database with EXPORT_FILE.
// The SQL is the CLI's db-init SQL, the same locally and on every cloud. Safe
// to run on every deploy: passwords are kept, secrets written only when they
// change.

const { Client } = require('pg');
const { randomBytes } = require('crypto');
const { spawn } = require('child_process');
const { PassThrough } = require('stream');
const { pipeline } = require('stream/promises');

const SERVER_SQL = ${JSON.stringify(options.sql.server)};

const DATABASE_SQL = ${JSON.stringify(options.sql.database)};

const APP_ROLE_SUFFIX = ${JSON.stringify(options.appRoleSuffix)};
const CREATES_DATABASE = ${profile.createsDatabase};
const MANAGES_OWNER = ${profile.managesOwner};
const URL_QUERY = ${JSON.stringify(profile.urlQuery)};

// =============================================================================
// SECRET STORE
// =============================================================================

${profile.secretStore}

async function readAdminPassword() {
  ${profile.readAdminPassword}
}

// =============================================================================
// FILE STORE (MODE=export, MODE=restore)
// =============================================================================

${profile.fileStore}

// =============================================================================
// PASSWORDS, URLS, IDENTIFIERS
// =============================================================================

function generatePassword() {
  // 32 chars, alphanumeric only (no special chars that need URL encoding)
  return randomBytes(24).toString('base64').replace(/[+/=]/g, 'x');
}

// The password in a URL whose user is \`user\`, else null
function passwordFor(url, user) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (decodeURIComponent(parsed.username) !== user || !parsed.password) {
      return null;
    }
    return decodeURIComponent(parsed.password);
  } catch (e) {
    return null;
  }
}

function buildUrl(user, password, host, port, database) {
  return 'postgresql://' + user + ':' + encodeURIComponent(password) + '@' + host + ':' + port + '/' + database + URL_QUERY;
}

function quoteIdent(name) {
  return '"' + name.replace(/"/g, '""') + '"';
}

// Right after Terraform the database may not take connections yet
const TRANSIENT_CONNECT_ERRORS = ['ECONNREFUSED', 'ETIMEDOUT', 'EHOSTUNREACH', 'ECONNRESET', 'ENOTFOUND', '57P03'];
const CONNECT_ATTEMPTS = 6;
const CONNECT_RETRY_MS = 10000;

async function connectWithRetry(connect, database) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await connect(database);
    } catch (e) {
      if (!TRANSIENT_CONNECT_ERRORS.includes(e && e.code) || attempt >= CONNECT_ATTEMPTS) {
        throw e;
      }
      console.log('Database not reachable yet (' + e.code + '), retrying in ' + CONNECT_RETRY_MS / 1000 + 's (' + attempt + '/' + (CONNECT_ATTEMPTS - 1) + ')...');
      await new Promise((resolve) => setTimeout(resolve, CONNECT_RETRY_MS));
    }
  }
}

// The db-init SQL reads its parameters from tsdevstack.* settings
async function runDbInitSql(client, settings, sql) {
  await client.query(
    "SELECT set_config('tsdevstack.owner', $1, false), set_config('tsdevstack.app', $2, false), " +
      "set_config('tsdevstack.database', $3, false), set_config('tsdevstack.owner_password', $4, false), " +
      "set_config('tsdevstack.app_password', $5, false)",
    [settings.owner, settings.app, settings.database, settings.ownerPassword, settings.appPassword]
  );
  await client.query(sql);
}

// =============================================================================
// MODES
// =============================================================================

async function initService(service, connect, masterClient, dbHost, dbPort) {
  // Database and owner role are the service name
  const dbName = service;
  const owner = service;
  const app = service + APP_ROLE_SUFFIX;

  if (CREATES_DATABASE) {
    const dbExistsResult = await masterClient.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [dbName]
    );
    if ((dbExistsResult.rowCount || 0) === 0) {
      console.log('  -> Creating database: ' + dbName);
      await masterClient.query('CREATE DATABASE ' + quoteIdent(dbName));
    }
  }

  // Passwords: kept from the secrets. The owner's comes from DATABASE_URL
  // while that still holds the owner (environments from before the app
  // role); a role whose secret is missing gets a new one.
  const currentAppUrl = await readSecret(service, 'DATABASE_URL');
  const currentOwnerUrl = MANAGES_OWNER
    ? await readSecret(service, 'MIGRATION_DATABASE_URL')
    : null;
  const ownerPassword = MANAGES_OWNER
    ? passwordFor(currentOwnerUrl, owner) ||
      passwordFor(currentAppUrl, owner) ||
      generatePassword()
    : '';
  const appPassword = passwordFor(currentAppUrl, app) || generatePassword();

  const settings = { owner, app, database: dbName, ownerPassword, appPassword };
  await runDbInitSql(masterClient, settings, SERVER_SQL);
  const serviceClient = await connect(dbName);
  try {
    await runDbInitSql(serviceClient, settings, DATABASE_SQL);
  } finally {
    await serviceClient.end();
  }
  console.log('  [OK] Roles ' + owner + ' and ' + app);

  // The secrets only once the roles are in place, and only when they change
  if (MANAGES_OWNER) {
    const ownerUrl = buildUrl(owner, ownerPassword, dbHost, dbPort, dbName);
    if (currentOwnerUrl !== ownerUrl) {
      await writeSecret(service, 'MIGRATION_DATABASE_URL', ownerUrl);
      console.log('  [OK] MIGRATION_DATABASE_URL written');
    }
  }
  const appUrl = buildUrl(app, appPassword, dbHost, dbPort, dbName);
  if (currentAppUrl !== appUrl) {
    await writeSecret(service, 'DATABASE_URL', appUrl);
    console.log('  [OK] DATABASE_URL written');
  }
}

async function removeService(service, masterClient) {
  // The database first, in SQL: the owner owns it, and the admin is a member
  // of the owner (MODE=init grants it), so Postgres lets the admin drop it.
  // A cloud's own delete API may refuse a database its admin group doesn't
  // own (Cloud SQL does).
  const dbExists = await masterClient.query(
    'SELECT 1 FROM pg_database WHERE datname = $1',
    [service]
  );
  if ((dbExists.rowCount || 0) > 0) {
    // The service's own connections, one role at a time: Postgres refuses
    // to end a connection of a role the admin isn't a member of (the app
    // role, unless the cloud's admin group may signal) or of a superuser
    // (the cloud's own tools), and one refusal fails the whole statement.
    // The service is deleted before this runs; a connection left over makes
    // the drop below fail with a clear message.
    for (const role of [service, service + APP_ROLE_SUFFIX]) {
      try {
        await masterClient.query(
          'SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND usename = $2 AND pid <> pg_backend_pid()',
          [service, role]
        );
      } catch (e) {
        console.log('  [WARN] Could not close the connections of ' + role + ': ' + e.message);
      }
    }
    await masterClient.query('DROP DATABASE IF EXISTS ' + quoteIdent(service));
    console.log('  [OK] Database dropped: ' + service);
  } else {
    console.log('  [SKIP] No database ' + service);
  }

  for (const role of [service, service + APP_ROLE_SUFFIX]) {
    const exists = await masterClient.query(
      'SELECT 1 FROM pg_roles WHERE rolname = $1',
      [role]
    );
    if ((exists.rowCount || 0) > 0) {
      await masterClient.query('DROP ROLE ' + quoteIdent(role));
      console.log('  [OK] Role dropped: ' + role);
    } else {
      console.log('  [SKIP] No role ' + role);
    }
  }
}

// =============================================================================
// SAVED DATABASES (MODE=export, MODE=restore)
// =============================================================================

// pg_dump and pg_restore log in as the admin, like the rest of this job
function toolEnv(conn) {
  return Object.assign({}, process.env, {
    PGHOST: conn.host,
    PGPORT: String(conn.port),
    PGUSER: conn.user,
    PGPASSWORD: conn.password,
    PGSSLMODE: 'require',
  });
}

// The last lines a tool wrote to stderr, for the error message
function collectStderr(child) {
  let text = '';
  child.stderr.on('data', (chunk) => {
    text = (text + chunk).slice(-4000);
  });
  return () => text.trim().split('\\n').slice(-5).join(' | ');
}

function formatSize(bytes) {
  if (bytes < 1024 * 1024) return Math.max(1, Math.round(bytes / 1024)) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// The service's database in pg_dump's custom format, streamed to the file
// store. The upload only completes once pg_dump has finished without an
// error, so a failed save leaves no file.
async function exportService(service, file, masterClient, conn) {
  const exists = await masterClient.query(
    'SELECT 1 FROM pg_database WHERE datname = $1',
    [service]
  );
  if ((exists.rowCount || 0) === 0) {
    throw new Error('No database ' + service);
  }

  const dump = spawn(
    'pg_dump',
    ['--format=custom', '--no-owner', '--no-acl', '--dbname', service],
    { env: toolEnv(conn), stdio: ['ignore', 'pipe', 'pipe'] }
  );
  const lastLines = collectStderr(dump);
  const body = new PassThrough();
  let size = 0;
  dump.stdout.on('data', (chunk) => {
    size += chunk.length;
  });
  dump.stdout.pipe(body, { end: false });
  dump.on('error', (e) => body.destroy(e));
  dump.on('close', (code) => {
    if (code === 0) {
      body.end();
    } else {
      body.destroy(new Error('pg_dump failed (exit ' + code + '): ' + lastLines()));
    }
  });

  try {
    await uploadFile(file, body);
  } catch (e) {
    dump.kill();
    throw e;
  }
  console.log('  [OK] Saved ' + file + ' (' + formatSize(size) + ')');
}

// A cloud's own tools may hold a connection for a moment (Postgres error
// 55006, object in use): the drop is tried again a few times
async function dropDatabaseWhenFree(masterClient, service) {
  for (let attempt = 1; ; attempt++) {
    try {
      await masterClient.query('DROP DATABASE ' + quoteIdent(service));
      return;
    } catch (e) {
      if (e.code !== '55006' || attempt >= 5) throw e;
      console.log('  Database ' + service + ' still in use, trying again in 3s (' + attempt + '/4)');
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }
}

// Replaces the service's database with a saved file: the database is made
// again, empty, with the same encoding and collation (Terraform still finds
// it as it was), and pg_restore fills it in one transaction. The service
// can't connect until it is done.
async function restoreService(service, file, connect, masterClient, conn) {
  const owner = service;
  const app = service + APP_ROLE_SUFFIX;
  const db = quoteIdent(service);

  const current = await masterClient.query(
    'SELECT pg_encoding_to_char(encoding) AS encoding, datcollate, datctype FROM pg_database WHERE datname = $1',
    [service]
  );
  if ((current.rowCount || 0) === 0) {
    throw new Error('No database ' + service + ': deploy the service first');
  }
  const { encoding, datcollate, datctype } = current.rows[0];
  // Opened first: a missing file stops the restore before it changes anything
  const source = await downloadFile(file);

  // No new connections from the service, then its open ones closed. Closing
  // another role's connection needs that role's rights: the admin has the
  // owner's (MODE=init) and gets the app role's here.
  await masterClient.query('REVOKE CONNECT ON DATABASE ' + db + ' FROM ' + quoteIdent(app));
  const member = await masterClient.query(
    "SELECT pg_has_role(current_user, $1, 'USAGE') AS member",
    [app]
  );
  if (!member.rows[0].member) {
    await masterClient.query('GRANT ' + quoteIdent(app) + ' TO current_user');
  }
  for (const role of [owner, app]) {
    await masterClient.query(
      'SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND usename = $2 AND pid <> pg_backend_pid()',
      [service, role]
    );
  }

  await dropDatabaseWhenFree(masterClient, service);
  await masterClient.query(
    'CREATE DATABASE ' + db + ' OWNER ' + quoteIdent(owner) + ' TEMPLATE template0' +
      ' ENCODING ' + masterClient.escapeLiteral(encoding) +
      ' LC_COLLATE ' + masterClient.escapeLiteral(datcollate) +
      ' LC_CTYPE ' + masterClient.escapeLiteral(datctype)
  );
  // Only the admin connects until the restore is done
  await masterClient.query('REVOKE ALL ON DATABASE ' + db + ' FROM PUBLIC');
  await masterClient.query('GRANT CONNECT ON DATABASE ' + db + ' TO current_user');

  const restore = spawn(
    'pg_restore',
    ['--no-owner', '--no-acl', '--single-transaction', '--exit-on-error', '--dbname', service],
    { env: toolEnv(conn), stdio: ['pipe', 'ignore', 'pipe'] }
  );
  const lastLines = collectStderr(restore);
  const exited = new Promise((resolve, reject) => {
    restore.on('error', reject);
    restore.on('close', resolve);
  });
  // A broken pipe means pg_restore stopped: its own message says why
  let streamError = null;
  try {
    await pipeline(source, restore.stdin);
  } catch (e) {
    streamError = e;
    if (e.code !== 'EPIPE') restore.kill();
  }
  const code = await exited;
  if (streamError && streamError.code !== 'EPIPE') {
    throw new Error('Reading ' + file + ' failed: ' + streamError.message);
  }
  if (code !== 0) {
    throw new Error('pg_restore failed (exit ' + code + '): ' + lastLines());
  }

  // What the restore made goes to the owner, the app role gets its rights,
  // then its connection back: the same SQL as MODE=init (passwords kept)
  const settings = { owner, app, database: service, ownerPassword: '', appPassword: '' };
  const serviceClient = await connect(service);
  try {
    await runDbInitSql(serviceClient, settings, DATABASE_SQL);
  } finally {
    await serviceClient.end();
  }
  await runDbInitSql(masterClient, settings, SERVER_SQL);
  console.log('  [OK] Restored ' + file + ' into ' + service);
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  const mode = process.env.MODE || 'init';
  console.log('db-init starting (' + mode + ')...');

  // Read environment
  const project = process.env.PROJECT;
  const environment = process.env.ENVIRONMENT;
  const dbHost = process.env.DB_HOST;
  const dbPort = process.env.DB_PORT || '5432';
  const adminUser = process.env.DB_ADMIN_USER || 'postgres';
  const servicesJson = process.env.SERVICES;

  // Validate required env vars
  if (!project || !environment || !dbHost || !servicesJson) {
    console.error('Missing required environment variables:');
    console.error('  PROJECT: ' + (project ? 'set' : 'MISSING'));
    console.error('  ENVIRONMENT: ' + (environment ? 'set' : 'MISSING'));
    console.error('  DB_HOST: ' + (dbHost ? 'set' : 'MISSING'));
    console.error('  SERVICES: ' + (servicesJson ? 'set' : 'MISSING'));
    process.exit(1);
    return;
  }
  const adminPassword = await readAdminPassword();
  if (!adminPassword) {
    console.error('Missing the admin password (${profile.adminPasswordSource})');
    process.exit(1);
    return;
  }
  if (!['init', 'remove', 'export', 'restore'].includes(mode)) {
    console.error('Unknown MODE: ' + mode);
    process.exit(1);
    return;
  }

  // SERVICES: [{ name, hasDatabase }] (init) or the names (the other modes)
  let services;
  try {
    services = JSON.parse(servicesJson)
      .filter((s) => typeof s === 'string' || s.hasDatabase)
      .map((s) => (typeof s === 'string' ? s : s.name));
  } catch (e) {
    console.error('Failed to parse SERVICES JSON: ' + e.message);
    process.exit(1);
    return;
  }

  if (services.length === 0) {
    console.log('No services with databases. Exiting.');
    return;
  }
  console.log('Services: ' + services.join(', '));

  // MODE=export and MODE=restore: one service and its file
  const exportFile = process.env.EXPORT_FILE;
  if ((mode === 'export' || mode === 'restore') && (!exportFile || services.length !== 1)) {
    console.error('MODE=' + mode + ' needs EXPORT_FILE and one service in SERVICES');
    process.exit(1);
    return;
  }
  const conn = { host: dbHost, port: dbPort, user: adminUser, password: adminPassword };

  const connect = async (database) => {
    const client = new Client({
      host: dbHost,
      port: parseInt(dbPort),
      user: adminUser,
      password: adminPassword,
      database,
      ssl: { rejectUnauthorized: false },
    });
    await client.connect();
    return client;
  };

  const masterClient = await connectWithRetry(connect, 'postgres');
  console.log('Connected to ' + dbHost + ':' + dbPort + ' as ' + adminUser);

  try {
    for (const service of services) {
      console.log('');
      console.log('Processing: ' + service);
      if (mode === 'remove') {
        await removeService(service, masterClient);
      } else if (mode === 'export') {
        await exportService(service, exportFile, masterClient, conn);
      } else if (mode === 'restore') {
        await restoreService(service, exportFile, connect, masterClient, conn);
      } else {
        await initService(service, connect, masterClient, dbHost, dbPort);
      }
    }
  } finally {
    await masterClient.end();
  }

  console.log('');
  console.log('db-init completed successfully');
}

// Only the message: a failed statement's context could hold a password
main().catch((e) => {
  console.error('db-init failed: ' + (e && e.message ? e.message : String(e)));
  process.exit(1);
});
`;
}
