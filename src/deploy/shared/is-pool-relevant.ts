/**
 * Is Pool Relevant
 *
 * Determines if a config service uses the database and therefore
 * affects connection pool sizing. A service is pool-relevant if:
 * - It has hasDatabase === true, OR
 * - It's a worker whose base service has hasDatabase === true
 */

interface ConfigService {
  name: string;
  type: string;
  hasDatabase?: boolean;
  baseService?: string;
}

export function isPoolRelevant(
  service: ConfigService,
  allServices: ConfigService[],
): boolean {
  if (service.hasDatabase) {
    return true;
  }

  if (service.type === 'worker' && service.baseService) {
    const base = allServices.find((s) => s.name === service.baseService);
    return base?.hasDatabase === true;
  }

  return false;
}
