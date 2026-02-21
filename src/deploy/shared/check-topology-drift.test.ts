/**
 * Tests for check-topology-drift utility
 *
 * Pure comparison function — no cloud calls, no mocks needed.
 */

import { describe, it, expect } from '@rstest/core';
import { checkTopologyDrift } from './check-topology-drift';
import { InfraCoreError } from '../../runtime/infra-core-error.ts';

describe('checkTopologyDrift', () => {
  describe('allows deployment', () => {
    it('should not throw when topology matches', () => {
      expect(() =>
        checkTopologyDrift({
          targetEnv: 'dev',
          deployedServices: [
            {
              name: 'auth-service',
              type: 'nestjs',
              resources: { hasDatabase: true },
            },
            {
              name: 'offers-service',
              type: 'nestjs',
              resources: { hasDatabase: true },
            },
          ],
          configServices: [
            { name: 'auth-service', type: 'nestjs', hasDatabase: true },
            { name: 'offers-service', type: 'nestjs', hasDatabase: true },
          ],
        }),
      ).not.toThrow();
    });

    it('should not throw when nothing is deployed (first deploy)', () => {
      expect(() =>
        checkTopologyDrift({
          targetEnv: 'dev',
          deployedServices: [],
          configServices: [
            { name: 'auth-service', type: 'nestjs', hasDatabase: true },
          ],
        }),
      ).not.toThrow();
    });

    it('should not throw when topology matches with workers', () => {
      expect(() =>
        checkTopologyDrift({
          targetEnv: 'dev',
          deployedServices: [
            {
              name: 'auth-service',
              type: 'nestjs',
              resources: { hasDatabase: true },
            },
            {
              name: 'auth-worker',
              type: 'worker',
              resources: { hasDatabase: true },
            },
          ],
          configServices: [
            { name: 'auth-service', type: 'nestjs', hasDatabase: true },
            {
              name: 'auth-worker',
              type: 'worker',
              baseService: 'auth-service',
            },
          ],
        }),
      ).not.toThrow();
    });

    it('should ignore order differences', () => {
      expect(() =>
        checkTopologyDrift({
          targetEnv: 'dev',
          deployedServices: [
            {
              name: 'offers-service',
              type: 'nestjs',
              resources: { hasDatabase: true },
            },
            {
              name: 'auth-service',
              type: 'nestjs',
              resources: { hasDatabase: true },
            },
          ],
          configServices: [
            { name: 'auth-service', type: 'nestjs', hasDatabase: true },
            { name: 'offers-service', type: 'nestjs', hasDatabase: true },
          ],
        }),
      ).not.toThrow();
    });
  });

  describe('blocks deployment', () => {
    it('should throw when config has more db services than deployed', () => {
      expect(() =>
        checkTopologyDrift({
          targetEnv: 'dev',
          deployedServices: [
            {
              name: 'auth-service',
              type: 'nestjs',
              resources: { hasDatabase: true },
            },
          ],
          configServices: [
            { name: 'auth-service', type: 'nestjs', hasDatabase: true },
            { name: 'offers-service', type: 'nestjs', hasDatabase: true },
          ],
        }),
      ).toThrow(InfraCoreError);
    });

    it('should throw when config has fewer db services than deployed', () => {
      expect(() =>
        checkTopologyDrift({
          targetEnv: 'dev',
          deployedServices: [
            {
              name: 'auth-service',
              type: 'nestjs',
              resources: { hasDatabase: true },
            },
            {
              name: 'offers-service',
              type: 'nestjs',
              resources: { hasDatabase: true },
            },
          ],
          configServices: [
            { name: 'auth-service', type: 'nestjs', hasDatabase: true },
          ],
        }),
      ).toThrow(InfraCoreError);
    });

    it('should list added services in error message', () => {
      expect(() =>
        checkTopologyDrift({
          targetEnv: 'dev',
          deployedServices: [
            {
              name: 'auth-service',
              type: 'nestjs',
              resources: { hasDatabase: true },
            },
          ],
          configServices: [
            { name: 'auth-service', type: 'nestjs', hasDatabase: true },
            { name: 'offers-service', type: 'nestjs', hasDatabase: true },
          ],
        }),
      ).toThrow(/Added.*offers-service/);
    });

    it('should list removed services in error message', () => {
      expect(() =>
        checkTopologyDrift({
          targetEnv: 'dev',
          deployedServices: [
            {
              name: 'auth-service',
              type: 'nestjs',
              resources: { hasDatabase: true },
            },
            {
              name: 'old-service',
              type: 'nestjs',
              resources: { hasDatabase: true },
            },
          ],
          configServices: [
            { name: 'auth-service', type: 'nestjs', hasDatabase: true },
          ],
        }),
      ).toThrow(/Removed.*old-service/);
    });

    it('should include env in remediation message', () => {
      expect(() =>
        checkTopologyDrift({
          targetEnv: 'staging',
          deployedServices: [
            {
              name: 'auth-service',
              type: 'nestjs',
              resources: { hasDatabase: true },
            },
          ],
          configServices: [
            { name: 'auth-service', type: 'nestjs', hasDatabase: true },
            { name: 'offers-service', type: 'nestjs', hasDatabase: true },
          ],
        }),
      ).toThrow(/--env staging/);
    });

    it('should throw when a new worker with db base is added', () => {
      expect(() =>
        checkTopologyDrift({
          targetEnv: 'dev',
          deployedServices: [
            {
              name: 'auth-service',
              type: 'nestjs',
              resources: { hasDatabase: true },
            },
          ],
          configServices: [
            { name: 'auth-service', type: 'nestjs', hasDatabase: true },
            {
              name: 'auth-worker',
              type: 'worker',
              baseService: 'auth-service',
            },
          ],
        }),
      ).toThrow(InfraCoreError);
    });
  });

  describe('excludes non-pool-relevant services', () => {
    it('should exclude nestjs without database from config comparison', () => {
      expect(() =>
        checkTopologyDrift({
          targetEnv: 'dev',
          deployedServices: [
            {
              name: 'auth-service',
              type: 'nestjs',
              resources: { hasDatabase: true },
            },
          ],
          configServices: [
            { name: 'auth-service', type: 'nestjs', hasDatabase: true },
            { name: 'bff-service', type: 'nestjs', hasDatabase: false },
          ],
        }),
      ).not.toThrow();
    });

    it('should exclude deployed services with hasDatabase: false', () => {
      expect(() =>
        checkTopologyDrift({
          targetEnv: 'dev',
          deployedServices: [
            {
              name: 'auth-service',
              type: 'nestjs',
              resources: { hasDatabase: true },
            },
            {
              name: 'bff-service',
              type: 'nestjs',
              resources: { hasDatabase: false },
            },
          ],
          configServices: [
            { name: 'auth-service', type: 'nestjs', hasDatabase: true },
          ],
        }),
      ).not.toThrow();
    });

    it('should exclude SPAs from deployed comparison', () => {
      expect(() =>
        checkTopologyDrift({
          targetEnv: 'dev',
          deployedServices: [
            {
              name: 'auth-service',
              type: 'nestjs',
              resources: { hasDatabase: true },
            },
            { name: 'my-spa', type: 'spa' },
          ],
          configServices: [
            { name: 'auth-service', type: 'nestjs', hasDatabase: true },
          ],
        }),
      ).not.toThrow();
    });

    it('should exclude nextjs from deployed comparison', () => {
      expect(() =>
        checkTopologyDrift({
          targetEnv: 'dev',
          deployedServices: [
            {
              name: 'auth-service',
              type: 'nestjs',
              resources: { hasDatabase: true },
            },
            { name: 'frontend', type: 'nextjs' },
          ],
          configServices: [
            { name: 'auth-service', type: 'nestjs', hasDatabase: true },
          ],
        }),
      ).not.toThrow();
    });

    it('should exclude kong from deployed comparison', () => {
      expect(() =>
        checkTopologyDrift({
          targetEnv: 'dev',
          deployedServices: [
            {
              name: 'auth-service',
              type: 'nestjs',
              resources: { hasDatabase: true },
            },
            { name: 'kong', type: 'kong' },
          ],
          configServices: [
            { name: 'auth-service', type: 'nestjs', hasDatabase: true },
          ],
        }),
      ).not.toThrow();
    });

    it('should exclude worker whose base service has no database', () => {
      expect(() =>
        checkTopologyDrift({
          targetEnv: 'dev',
          deployedServices: [
            {
              name: 'auth-service',
              type: 'nestjs',
              resources: { hasDatabase: true },
            },
          ],
          configServices: [
            { name: 'auth-service', type: 'nestjs', hasDatabase: true },
            { name: 'bff-service', type: 'nestjs', hasDatabase: false },
            { name: 'bff-worker', type: 'worker', baseService: 'bff-service' },
          ],
        }),
      ).not.toThrow();
    });
  });

  describe('deployed side type fallback', () => {
    it('should use type-based fallback when resources.hasDatabase is undefined', () => {
      expect(() =>
        checkTopologyDrift({
          targetEnv: 'dev',
          deployedServices: [
            { name: 'auth-service', type: 'nestjs' },
            { name: 'offers-service', type: 'nestjs' },
          ],
          configServices: [
            { name: 'auth-service', type: 'nestjs', hasDatabase: true },
            { name: 'offers-service', type: 'nestjs', hasDatabase: true },
          ],
        }),
      ).not.toThrow();
    });

    it('should treat backend type as pool-relevant in fallback (pre-unification)', () => {
      expect(() =>
        checkTopologyDrift({
          targetEnv: 'dev',
          deployedServices: [
            { name: 'auth-service', type: 'backend' },
            { name: 'offers-service', type: 'backend' },
          ],
          configServices: [
            { name: 'auth-service', type: 'nestjs', hasDatabase: true },
            { name: 'offers-service', type: 'nestjs', hasDatabase: true },
          ],
        }),
      ).not.toThrow();
    });
  });
});
