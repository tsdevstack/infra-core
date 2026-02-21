/**
 * Extract import targets from terraform "already exists" errors
 */

export interface ImportTarget {
  /** Terraform resource address (e.g., "azurerm_cdn_frontdoor_custom_domain.app") */
  address: string;
  /** Cloud resource ID (e.g., "/subscriptions/xxx/.../customDomains/aaa") */
  resourceId: string;
}

/**
 * Extracts resource addresses and IDs from terraform "already exists" errors.
 *
 * Parses errors like:
 *   Error: A resource with the ID "/subscriptions/xxx/..." already exists
 *     with azurerm_cdn_frontdoor_custom_domain.app,
 *
 * @param output - The terraform output/error text
 * @returns Array of import targets, empty if none found
 */
export function extractImportTargets(output: string): ImportTarget[] {
  const targets: ImportTarget[] = [];

  const errorBlockRegex =
    /A resource with the ID "([^"]+)" already exists[^]*?with ([^,\s]+),/g;

  let match: RegExpExecArray | null;
  while ((match = errorBlockRegex.exec(output)) !== null) {
    targets.push({
      resourceId: match[1],
      address: match[2],
    });
  }

  return targets;
}
