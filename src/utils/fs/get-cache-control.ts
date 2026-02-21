/**
 * Get Cache-Control header based on file path
 *
 * Strategy for optimal CDN performance:
 * - index.html: no-cache (always validate)
 * - Hashed assets (*.hash.js, *.hash.css): immutable, 1 year
 * - Other static assets: 1 day cache
 */

import path from 'node:path';

/**
 * Get Cache-Control header based on file path
 */
export function getCacheControl(filePath: string): string {
  const basename = path.basename(filePath);

  // index.html - always revalidate
  if (basename === 'index.html') {
    return 'no-cache, must-revalidate';
  }

  // Hashed assets (Vite/webpack pattern: name.hash.ext or name-hash.ext)
  // Examples: main.a1b2c3d4.js, chunk-vendors.5e6f7g8h.css, index-BxK4F2Zq.js
  const hashedPattern = /[.-][a-f0-9]{8,}\.(?:js|css|woff2?|ttf|eot)$/i;
  if (hashedPattern.test(basename)) {
    return 'public, max-age=31536000, immutable';
  }

  // Default: 1 day cache for other static assets
  return 'public, max-age=86400';
}
