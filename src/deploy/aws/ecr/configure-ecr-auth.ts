/**
 * Configure Docker authentication for AWS ECR
 *
 * Supports two modes:
 * - Explicit credentials (local): Use AWS SDK to get auth token
 * - ADC (CI with OIDC): Use AWS CLI (credentials from environment)
 */

import { execSync, spawnSync } from 'node:child_process';
import { ECRClient, GetAuthorizationTokenCommand } from '@aws-sdk/client-ecr';
import type { AWSCredentials } from '../../../types/credentials.ts';
import type { InfraCoreRuntime } from '../../../types/runtime.ts';
import { InfraCoreError } from '../../../runtime/infra-core-error.ts';
import { dockerLoginWithRetry } from '../../shared/docker-login-with-retry.ts';

/**
 * Login to Docker registry using stdin for password (avoids shell escaping issues)
 */
function dockerLogin(registryHost: string, password: string): void {
  const result = spawnSync(
    'docker',
    ['login', '--username', 'AWS', '--password-stdin', registryHost],
    {
      input: password,
      encoding: 'utf-8',
    },
  );

  if (result.status !== 0) {
    const errorMsg = result.stderr || result.stdout || 'Unknown error';
    throw new Error(`Docker login failed: ${errorMsg}`);
  }
}

/**
 * Configure Docker to authenticate with ECR
 */
export async function configureEcrAuth(
  runtime: InfraCoreRuntime,
  credentials: AWSCredentials,
  ecrUrl: string,
): Promise<void> {
  // Extract registry host from ECR URL (e.g., 123456789.dkr.ecr.us-east-1.amazonaws.com)
  const registryHost = ecrUrl.replace(/^https?:\/\//, '');

  // CI mode: use AWS CLI (credentials from OIDC/environment)
  if (runtime.isCIEnv()) {
    try {
      const password = execSync(
        `aws ecr get-login-password --region ${credentials.region}`,
        { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] },
      ).trim();

      await dockerLoginWithRetry(() => dockerLogin(registryHost, password));
      return;
    } catch (error) {
      if (error instanceof InfraCoreError) throw error;
      const msg = error instanceof Error ? error.message : 'Unknown error';
      throw new InfraCoreError(
        'Failed to configure Docker with AWS CLI',
        'ecr-auth',
        `${msg}\n\nEnsure AWS credentials are configured and Docker is running.`,
      );
    }
  }

  // Local mode: use AWS SDK with explicit credentials
  const ecr = new ECRClient({
    region: credentials.region,
    credentials: {
      accessKeyId: credentials.accessKeyId,
      secretAccessKey: credentials.secretAccessKey,
    },
  });

  let authToken: string | undefined;
  try {
    const response = await ecr.send(new GetAuthorizationTokenCommand({}));
    authToken = response.authorizationData?.[0]?.authorizationToken;
  } catch {
    throw new InfraCoreError(
      'Failed to get ECR authorization token',
      'ecr-auth',
      'Check that your AWS credentials are valid and have ECR permissions',
    );
  }

  if (!authToken) {
    throw new InfraCoreError(
      'No authorization token returned from ECR',
      'ecr-auth',
      'Check that your AWS credentials have the required permissions',
    );
  }

  // Token is base64 encoded "AWS:<password>"
  const decoded = Buffer.from(authToken, 'base64').toString('utf-8');
  const password = decoded.split(':')[1];

  if (!password) {
    throw new InfraCoreError(
      'Invalid authorization token format from ECR',
      'ecr-auth',
      'Received malformed token from AWS ECR',
    );
  }

  // Login to Docker using the token (with retry for API propagation delays)
  try {
    await dockerLoginWithRetry(() => dockerLogin(registryHost, password));
  } catch (error) {
    if (error instanceof InfraCoreError) throw error;
    const msg = error instanceof Error ? error.message : 'Unknown error';
    throw new InfraCoreError(
      'Failed to authenticate Docker with ECR',
      'ecr-auth',
      `${msg}\n\nEnsure Docker is running and you have permission to push to the registry.`,
    );
  }
}
