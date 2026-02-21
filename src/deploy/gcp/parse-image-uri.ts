/**
 * Parse Docker image URI into components
 *
 * Used for Docker Registry v2 API calls to verify image existence.
 */

export interface ImageUriComponents {
  /** Registry hostname (e.g., "us-central1-docker.pkg.dev") */
  registry: string;
  /** Repository path (e.g., "project-id/repo/image") */
  repository: string;
  /** Image tag (defaults to "latest") */
  tag: string;
}

/**
 * Parse image URI into components
 *
 * @example
 * parseImageUri("us-central1-docker.pkg.dev/project-id/repo/image:tag")
 * // Returns: { registry: "us-central1-docker.pkg.dev", repository: "project-id/repo/image", tag: "tag" }
 */
export function parseImageUri(imageUri: string): ImageUriComponents {
  // Format: registry/project/repo/image:tag
  const [registry, ...rest] = imageUri.split('/');
  const pathWithTag = rest.join('/');

  // Split off the tag
  const colonIndex = pathWithTag.lastIndexOf(':');
  if (colonIndex === -1) {
    return { registry, repository: pathWithTag, tag: 'latest' };
  }

  const repository = pathWithTag.substring(0, colonIndex);
  const tag = pathWithTag.substring(colonIndex + 1);

  return { registry, repository, tag };
}
