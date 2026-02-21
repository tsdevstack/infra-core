/**
 * Get MIME type from file extension
 *
 * Used for setting correct Content-Type when uploading to Cloud Storage.
 */

import path from 'node:path';
import { MIME_TYPES } from '../../constants/index.ts';

/**
 * Get MIME type from file path based on extension
 */
export function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
}
