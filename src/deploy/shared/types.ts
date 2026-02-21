/**
 * Shared types for deployment utilities
 */

/**
 * Configuration for a secret to be injected into Cloud Run
 */
export interface SecretConfig {
  envVar: string;
  secretName: string;
  version: string;
}

/**
 * Function signature for building secret names
 */
export type BuildSecretNameFn = (
  projectName: string,
  scope: string,
  key: string,
) => string;
