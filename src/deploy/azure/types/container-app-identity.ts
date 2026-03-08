/**
 * Container App Identity
 *
 * Typed identity configuration for Azure Container Apps.
 * Used when assigning user-assigned managed identities (e.g., for ACR pull).
 */

export interface ContainerAppIdentity {
  type: 'UserAssigned' | 'SystemAssigned';
  userAssignedIdentities?: Record<string, Record<string, never>>;
}
