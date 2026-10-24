import { describe, it, expect, rs, beforeEach } from '@rstest/core';
import type { InfraCoreRuntime } from '../../types/runtime.ts';
import type { GCPCredentials } from '../../types/credentials.ts';

const { mockUpdateService } = rs.hoisted(() => ({
  mockUpdateService: rs.fn(),
}));

rs.mock('@google-cloud/run', () => ({
  ServicesClient: rs.fn().mockImplementation(function () {
    return { updateService: mockUpdateService };
  }),
}));

rs.mock('./set-service-invoker-policy.ts', () => ({
  setServiceInvokerPolicy: rs.fn().mockResolvedValue(undefined),
}));

import {
  deployCloudRunService,
  type CloudRunServiceOptions,
} from './cloud-run-services.ts';

describe('deployCloudRunService', () => {
  const runtime = {
    logger: { info: rs.fn(), warn: rs.fn(), error: rs.fn(), debug: rs.fn() },
  } as unknown as InfraCoreRuntime;

  const options: CloudRunServiceOptions = {
    projectId: 'shop-prod',
    region: 'us-central1',
    serviceName: 'offers-service',
    imageUri: 'us-docker.pkg.dev/shop-prod/repo/offers-service:abc',
    serviceAccount: 'offers@shop-prod.iam.gserviceaccount.com',
    credentials: {
      project_id: 'shop-prod',
      client_email: 'deployer@shop-prod.iam.gserviceaccount.com',
      private_key: 'key',
    } as unknown as GCPCredentials,
    minInstances: 0,
    maxInstances: 3,
    cpu: '1',
    memory: '512Mi',
    timeout: '300s',
    concurrency: 80,
    envVars: { NODE_ENV: 'production' },
    secrets: [],
    ingress: 'INGRESS_TRAFFIC_INTERNAL_ONLY',
  };

  beforeEach(() => {
    rs.clearAllMocks();
    mockUpdateService.mockResolvedValue([
      { promise: async () => [{ uri: 'https://offers-service.run.app' }] },
    ]);
  });

  const deployedContainer = (): Record<string, unknown> => {
    const [request] = mockUpdateService.mock.calls[0] as [
      { service: { template: { containers: Record<string, unknown>[] } } },
    ];
    return request.service.template.containers[0];
  };

  describe('Startup probe', () => {
    it('should probe /health every 2 s for up to 120 s', async () => {
      await deployCloudRunService(runtime, options);

      expect(deployedContainer().startupProbe).toEqual({
        httpGet: { path: '/health', port: 8080 },
        initialDelaySeconds: 0,
        timeoutSeconds: 3,
        periodSeconds: 2,
        failureThreshold: 60,
      });
    });

    it('should stay within the Cloud Run limit of 600 s startup time', async () => {
      await deployCloudRunService(runtime, options);

      const probe = deployedContainer().startupProbe as {
        initialDelaySeconds: number;
        periodSeconds: number;
        failureThreshold: number;
      };
      expect(
        probe.initialDelaySeconds +
          probe.periodSeconds * probe.failureThreshold,
      ).toBeLessThanOrEqual(600);
    });

    it('should not add a liveness probe', async () => {
      await deployCloudRunService(runtime, options);

      expect(deployedContainer()).not.toHaveProperty('livenessProbe');
    });
  });

  describe('Result', () => {
    it('should return the service URL', async () => {
      await expect(deployCloudRunService(runtime, options)).resolves.toEqual({
        success: true,
        serviceUrl: 'https://offers-service.run.app',
      });
    });
  });
});
