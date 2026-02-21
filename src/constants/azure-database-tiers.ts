/**
 * Azure PostgreSQL Flexible Server Database Tiers and Connection Limits
 *
 * Maps Azure Flexible Server SKU names to their maximum connection limits.
 * Verified from Microsoft docs:
 * https://learn.microsoft.com/en-us/azure/postgresql/flexible-server/concepts-limits
 * Used to calculate appropriate connection pool sizes for Container App services.
 */

export const AZURE_DATABASE_CONNECTION_LIMITS: Record<string, number> = {
  B_Standard_B1ms: 50,
  B_Standard_B2s: 429,
  B_Standard_B2ms: 859,
  GP_Standard_D2s_v3: 859,
  GP_Standard_D4s_v3: 1718,
  MO_Standard_E4s_v3: 3437,
};

export const DEFAULT_AZURE_DATABASE_TIER = 'B_Standard_B1ms';
