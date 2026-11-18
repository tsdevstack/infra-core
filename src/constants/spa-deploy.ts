/**
 * SPA deploys
 */

/**
 * How long a file left out of the new build stays in the SPA bucket, counted
 * from its last upload (every deploy uploads every file of its build). A
 * visitor who still has the previous version open can then load its pages'
 * files after a deploy, instead of getting index.html in their place.
 */
export const SPA_OLD_FILE_RETENTION_MS = 24 * 60 * 60 * 1000;
