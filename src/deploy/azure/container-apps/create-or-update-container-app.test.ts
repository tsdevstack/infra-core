/**
 * Tests for create-or-update-container-app
 */

import { describe, it, expect, rs, beforeEach } from '@rstest/core';

const mockBeginCreateOrUpdateAndWait = rs.fn();

// Mock Azure credential helper
rs.mock('../create-azure-credential', () => ({
  createAzureCredential: rs.fn(() => ({})),
}));

// Mock Azure Container Apps client
rs.mock('@azure/arm-appcontainers', () => ({
  ContainerAppsAPIClient: class MockContainerAppsAPIClient {
    containerApps = {
      beginCreateOrUpdateAndWait: mockBeginCreateOrUpdateAndWait,
    };
    constructor() {}
  },
}));

import { createOrUpdateContainerApp } from './create-or-update-container-app';

const mockRuntime = {
  logger: {
    info: rs.fn(),
    success: rs.fn(),
    error: rs.fn(),
    warn: rs.fn(),
    debug: rs.fn(),
    newline: rs.fn(),
    generating: rs.fn(),
    running: rs.fn(),
    creating: rs.fn(),
    building: rs.fn(),
    checking: rs.fn(),
    complete: rs.fn(),
  },
  executeCommand: rs.fn(),
  writeFile: rs.fn(),
  readFile: rs.fn(),
  ensureDirectory: rs.fn(),
  cleanupFolder: rs.fn(),
  isCIEnv: rs.fn(),
};

const testCredentials = {
  clientId: 'test-client-id',
  clientSecret: 'test-client-secret',
  tenantId: 'test-tenant-id',
  subscriptionId: 'test-subscription-id',
  location: 'eastus2',
};

describe('createOrUpdateContainerApp', () => {
  beforeEach(() => {
    rs.clearAllMocks();
  });

  describe('Standard use cases', () => {
    it('should return success with fqdn when Container App is created', async () => {
      mockBeginCreateOrUpdateAndWait.mockResolvedValue({
        configuration: {
          ingress: {
            fqdn: 'test-app.azurecontainerapps.io',
          },
        },
      });

      const result = await createOrUpdateContainerApp(mockRuntime, {
        credentials: testCredentials,
        resourceGroupName: 'test-rg',
        containerAppName: 'test-app',
        containerAppsEnvId:
          '/subscriptions/sub/resourceGroups/rg/providers/Microsoft.App/managedEnvironments/env',
        image: 'myregistry.azurecr.io/myapp:latest',
        ingressPort: 3000,
      });

      expect(result.fqdn).toBe('test-app.azurecontainerapps.io');
      expect(mockBeginCreateOrUpdateAndWait).toHaveBeenCalledWith(
        'test-rg',
        'test-app',
        expect.objectContaining({
          location: 'eastus2',
          environmentId:
            '/subscriptions/sub/resourceGroups/rg/providers/Microsoft.App/managedEnvironments/env',
        }),
      );
    });

    it('should return success without fqdn when no ingress is configured', async () => {
      mockBeginCreateOrUpdateAndWait.mockResolvedValue({
        configuration: {},
      });

      const result = await createOrUpdateContainerApp(mockRuntime, {
        credentials: testCredentials,
        resourceGroupName: 'test-rg',
        containerAppName: 'test-worker',
        containerAppsEnvId:
          '/subscriptions/sub/resourceGroups/rg/providers/Microsoft.App/managedEnvironments/env',
        image: 'myregistry.azurecr.io/worker:latest',
      });

      expect(result.fqdn).toBeUndefined();
    });
  });

  describe('Optional fields', () => {
    it('should pass command override to container definition', async () => {
      mockBeginCreateOrUpdateAndWait.mockResolvedValue({
        configuration: {},
      });

      await createOrUpdateContainerApp(mockRuntime, {
        credentials: testCredentials,
        resourceGroupName: 'test-rg',
        containerAppName: 'test-app',
        containerAppsEnvId:
          '/subscriptions/sub/resourceGroups/rg/providers/Microsoft.App/managedEnvironments/env',
        image: 'myregistry.azurecr.io/myapp:latest',
        command: ['node', 'dist/main.js'],
      });

      const callArgs = mockBeginCreateOrUpdateAndWait.mock.calls[0];
      const containerAppEnvelope = callArgs[2];
      const container = containerAppEnvelope.template.containers[0];
      expect(container.command).toEqual(['node', 'dist/main.js']);
    });

    it('should configure ingress with external access', async () => {
      mockBeginCreateOrUpdateAndWait.mockResolvedValue({
        configuration: {
          ingress: {
            fqdn: 'test-app.azurecontainerapps.io',
          },
        },
      });

      await createOrUpdateContainerApp(mockRuntime, {
        credentials: testCredentials,
        resourceGroupName: 'test-rg',
        containerAppName: 'test-app',
        containerAppsEnvId:
          '/subscriptions/sub/resourceGroups/rg/providers/Microsoft.App/managedEnvironments/env',
        image: 'myregistry.azurecr.io/myapp:latest',
        ingressPort: 8080,
        externalIngress: true,
      });

      const callArgs = mockBeginCreateOrUpdateAndWait.mock.calls[0];
      const containerAppEnvelope = callArgs[2];
      expect(containerAppEnvelope.configuration.ingress).toEqual({
        external: true,
        targetPort: 8080,
        transport: 'auto',
      });
    });

    it('should pass secrets to Container App configuration', async () => {
      mockBeginCreateOrUpdateAndWait.mockResolvedValue({
        configuration: {},
      });

      await createOrUpdateContainerApp(mockRuntime, {
        credentials: testCredentials,
        resourceGroupName: 'test-rg',
        containerAppName: 'test-app',
        containerAppsEnvId:
          '/subscriptions/sub/resourceGroups/rg/providers/Microsoft.App/managedEnvironments/env',
        image: 'myregistry.azurecr.io/myapp:latest',
        secrets: [{ name: 'db-password', value: 'secret123' }],
        secretEnvVars: [
          { name: 'DATABASE_PASSWORD', secretRef: 'db-password' },
        ],
      });

      const callArgs = mockBeginCreateOrUpdateAndWait.mock.calls[0];
      const containerAppEnvelope = callArgs[2];
      expect(containerAppEnvelope.configuration.secrets).toEqual([
        { name: 'db-password', value: 'secret123' },
      ]);
      const container = containerAppEnvelope.template.containers[0];
      expect(container.env).toContainEqual({
        name: 'DATABASE_PASSWORD',
        secretRef: 'db-password',
      });
    });

    it('should pass env vars to container definition', async () => {
      mockBeginCreateOrUpdateAndWait.mockResolvedValue({
        configuration: {},
      });

      await createOrUpdateContainerApp(mockRuntime, {
        credentials: testCredentials,
        resourceGroupName: 'test-rg',
        containerAppName: 'test-app',
        containerAppsEnvId:
          '/subscriptions/sub/resourceGroups/rg/providers/Microsoft.App/managedEnvironments/env',
        image: 'myregistry.azurecr.io/myapp:latest',
        envVars: [
          { name: 'NODE_ENV', value: 'production' },
          { name: 'PORT', value: '3000' },
        ],
      });

      const callArgs = mockBeginCreateOrUpdateAndWait.mock.calls[0];
      const containerAppEnvelope = callArgs[2];
      const container = containerAppEnvelope.template.containers[0];
      expect(container.env).toContainEqual({
        name: 'NODE_ENV',
        value: 'production',
      });
      expect(container.env).toContainEqual({ name: 'PORT', value: '3000' });
    });

    it('should apply custom scaling configuration without rules when no ingress', async () => {
      mockBeginCreateOrUpdateAndWait.mockResolvedValue({
        configuration: {},
      });

      await createOrUpdateContainerApp(mockRuntime, {
        credentials: testCredentials,
        resourceGroupName: 'test-rg',
        containerAppName: 'test-app',
        containerAppsEnvId:
          '/subscriptions/sub/resourceGroups/rg/providers/Microsoft.App/managedEnvironments/env',
        image: 'myregistry.azurecr.io/myapp:latest',
        minReplicas: 1,
        maxReplicas: 5,
        cpu: 0.5,
        memory: '1Gi',
      });

      const callArgs = mockBeginCreateOrUpdateAndWait.mock.calls[0];
      const containerAppEnvelope = callArgs[2];
      expect(containerAppEnvelope.template.scale).toEqual({
        minReplicas: 1,
        maxReplicas: 5,
        cooldownPeriod: 900,
        rules: undefined,
      });
      const container = containerAppEnvelope.template.containers[0];
      expect(container.resources).toEqual({ cpu: 0.5, memory: '1Gi' });
    });

    it('should include HTTP scaling rule when ingressPort is set', async () => {
      mockBeginCreateOrUpdateAndWait.mockResolvedValue({
        configuration: {
          ingress: { fqdn: 'test-app.azurecontainerapps.io' },
        },
      });

      await createOrUpdateContainerApp(mockRuntime, {
        credentials: testCredentials,
        resourceGroupName: 'test-rg',
        containerAppName: 'test-app',
        containerAppsEnvId:
          '/subscriptions/sub/resourceGroups/rg/providers/Microsoft.App/managedEnvironments/env',
        image: 'myregistry.azurecr.io/myapp:latest',
        ingressPort: 3000,
        minReplicas: 0,
        maxReplicas: 5,
      });

      const callArgs = mockBeginCreateOrUpdateAndWait.mock.calls[0];
      const containerAppEnvelope = callArgs[2];
      expect(containerAppEnvelope.template.scale).toEqual({
        minReplicas: 0,
        maxReplicas: 5,
        cooldownPeriod: 900,
        rules: [
          {
            name: 'http-scaling',
            http: {
              metadata: { concurrentRequests: '10' },
            },
          },
        ],
      });
    });
  });

  describe('Managed identity ACR auth', () => {
    it('should use managed identity for registry when acrManagedIdentityId is provided', async () => {
      mockBeginCreateOrUpdateAndWait.mockResolvedValue({
        configuration: {},
      });

      await createOrUpdateContainerApp(mockRuntime, {
        credentials: testCredentials,
        resourceGroupName: 'test-rg',
        containerAppName: 'test-app',
        containerAppsEnvId:
          '/subscriptions/sub/resourceGroups/rg/providers/Microsoft.App/managedEnvironments/env',
        image: 'myacr.azurecr.io/myapp:latest',
        acrLoginServer: 'myacr.azurecr.io',
        acrManagedIdentityId:
          '/subscriptions/sub/resourceGroups/rg/providers/Microsoft.ManagedIdentity/userAssignedIdentities/ca-identity',
      });

      const callArgs = mockBeginCreateOrUpdateAndWait.mock.calls[0];
      const containerAppEnvelope = callArgs[2];
      expect(containerAppEnvelope.configuration.registries).toEqual([
        {
          server: 'myacr.azurecr.io',
          identity:
            '/subscriptions/sub/resourceGroups/rg/providers/Microsoft.ManagedIdentity/userAssignedIdentities/ca-identity',
        },
      ]);
      expect(containerAppEnvelope.identity).toEqual({
        type: 'UserAssigned',
        userAssignedIdentities: {
          '/subscriptions/sub/resourceGroups/rg/providers/Microsoft.ManagedIdentity/userAssignedIdentities/ca-identity':
            {},
        },
      });
    });

    it('should not include acr-password secret when using managed identity', async () => {
      mockBeginCreateOrUpdateAndWait.mockResolvedValue({
        configuration: {},
      });

      await createOrUpdateContainerApp(mockRuntime, {
        credentials: testCredentials,
        resourceGroupName: 'test-rg',
        containerAppName: 'test-app',
        containerAppsEnvId:
          '/subscriptions/sub/resourceGroups/rg/providers/Microsoft.App/managedEnvironments/env',
        image: 'myacr.azurecr.io/myapp:latest',
        acrLoginServer: 'myacr.azurecr.io',
        acrManagedIdentityId: '/subscriptions/sub/identity',
      });

      const callArgs = mockBeginCreateOrUpdateAndWait.mock.calls[0];
      const containerAppEnvelope = callArgs[2];
      expect(containerAppEnvelope.configuration.secrets).toBeUndefined();
    });
  });

  describe('ACR registry auth', () => {
    it('should configure registry credentials when acrLoginServer is provided', async () => {
      mockBeginCreateOrUpdateAndWait.mockResolvedValue({
        configuration: {},
      });

      await createOrUpdateContainerApp(mockRuntime, {
        credentials: testCredentials,
        resourceGroupName: 'test-rg',
        containerAppName: 'test-app',
        containerAppsEnvId:
          '/subscriptions/sub/resourceGroups/rg/providers/Microsoft.App/managedEnvironments/env',
        image: 'myacr.azurecr.io/myapp:latest',
        acrLoginServer: 'myacr.azurecr.io',
      });

      const callArgs = mockBeginCreateOrUpdateAndWait.mock.calls[0];
      const containerAppEnvelope = callArgs[2];
      expect(containerAppEnvelope.configuration.registries).toEqual([
        {
          server: 'myacr.azurecr.io',
          username: 'test-client-id',
          passwordSecretRef: 'acr-password',
        },
      ]);
      expect(containerAppEnvelope.configuration.secrets).toContainEqual({
        name: 'acr-password',
        value: 'test-client-secret',
      });
    });

    it('should not configure registry when acrLoginServer is not provided', async () => {
      mockBeginCreateOrUpdateAndWait.mockResolvedValue({
        configuration: {},
      });

      await createOrUpdateContainerApp(mockRuntime, {
        credentials: testCredentials,
        resourceGroupName: 'test-rg',
        containerAppName: 'test-app',
        containerAppsEnvId:
          '/subscriptions/sub/resourceGroups/rg/providers/Microsoft.App/managedEnvironments/env',
        image: 'mcr.microsoft.com/hello-world:latest',
      });

      const callArgs = mockBeginCreateOrUpdateAndWait.mock.calls[0];
      const containerAppEnvelope = callArgs[2];
      expect(containerAppEnvelope.configuration.registries).toBeUndefined();
    });
  });

  describe('Error cases', () => {
    it('should throw on API error', async () => {
      mockBeginCreateOrUpdateAndWait.mockRejectedValue(
        new Error('Insufficient permissions'),
      );

      await expect(
        createOrUpdateContainerApp(mockRuntime, {
          credentials: testCredentials,
          resourceGroupName: 'test-rg',
          containerAppName: 'test-app',
          containerAppsEnvId:
            '/subscriptions/sub/resourceGroups/rg/providers/Microsoft.App/managedEnvironments/env',
          image: 'myregistry.azurecr.io/myapp:latest',
        }),
      ).rejects.toThrow('Failed to create or update Container App');
    });

    it('should throw with generic message when error has no message', async () => {
      mockBeginCreateOrUpdateAndWait.mockRejectedValue({});

      await expect(
        createOrUpdateContainerApp(mockRuntime, {
          credentials: testCredentials,
          resourceGroupName: 'test-rg',
          containerAppName: 'test-app',
          containerAppsEnvId:
            '/subscriptions/sub/resourceGroups/rg/providers/Microsoft.App/managedEnvironments/env',
          image: 'myregistry.azurecr.io/myapp:latest',
        }),
      ).rejects.toThrow('Failed to create or update Container App');
    });
  });
});
