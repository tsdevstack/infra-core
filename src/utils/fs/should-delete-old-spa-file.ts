/**
 * Whether an SPA deploy deletes a file left out of the new build: only once
 * its last upload is older than SPA_OLD_FILE_RETENTION_MS. Every deploy
 * uploads every file of its build, so that time is the last build the file
 * was part of. A file whose upload time the provider didn't give is deleted.
 */

import { SPA_OLD_FILE_RETENTION_MS } from '../../constants/spa-deploy.ts';

export function shouldDeleteOldSpaFile(
  lastUploaded: Date | undefined,
  now: Date,
): boolean {
  if (!lastUploaded || Number.isNaN(lastUploaded.getTime())) {
    return true;
  }
  return now.getTime() - lastUploaded.getTime() > SPA_OLD_FILE_RETENTION_MS;
}
