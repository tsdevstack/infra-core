/**
 * New instances on every deploy
 */

/**
 * Environment variable set to the deploy's time on every Cloud Run service
 * (GCP) and Container App (Azure). A redeploy of the same image tag is
 * otherwise no change, so the cloud keeps its running instances, and those
 * keep the secret values they read at startup (a changed database password,
 * for example). A new value every deploy starts a new revision, whose
 * instances read the secrets again. ECS on AWS does the same with
 * forceNewDeployment.
 */
export const DEPLOYED_AT_ENV_VAR = 'DEPLOYED_AT';
