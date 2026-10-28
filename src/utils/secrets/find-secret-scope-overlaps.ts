/**
 * Find the secret scopes a scope's name prefix also covers
 */

/**
 * Cloud rules grant a service the secrets named `{project}-{service}-*`. A
 * service named `auth` therefore also matches `{project}-auth-service-*`,
 * the secrets of `auth-service`. For each scope with such overlaps, this
 * returns the other scopes its rule must exclude.
 *
 * @param scopes - Every secret scope (the service names)
 * @returns Scope → the scopes its prefix also covers, sorted; scopes
 *   without overlaps are left out
 */
export function findSecretScopeOverlaps(
  scopes: string[],
): Record<string, string[]> {
  const unique = [...new Set(scopes)];
  const overlaps: Record<string, string[]> = {};

  for (const scope of unique) {
    const covered = unique
      .filter((other) => other.startsWith(`${scope}-`))
      .sort();
    if (covered.length > 0) {
      overlaps[scope] = covered;
    }
  }

  return overlaps;
}
