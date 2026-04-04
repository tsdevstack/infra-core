/**
 * Tests for get-total-worker-max-instances utility
 */

import { describe, it, expect } from '@rstest/core';
import { getTotalWorkerMaxInstances } from './get-total-worker-max-instances';

describe('getTotalWorkerMaxInstances', () => {
  it('should return 3 for one pool-relevant worker (default)', () => {
    const services = [
      { name: 'auth-service', type: 'nestjs', hasDatabase: true },
      { name: 'auth-worker', type: 'worker', baseService: 'auth-service' },
    ];
    expect(getTotalWorkerMaxInstances(services)).toBe(3);
  });

  it('should return 6 for two pool-relevant workers (default)', () => {
    const services = [
      { name: 'auth-service', type: 'nestjs', hasDatabase: true },
      { name: 'offers-service', type: 'nestjs', hasDatabase: true },
      { name: 'auth-worker', type: 'worker', baseService: 'auth-service' },
      { name: 'offers-worker', type: 'worker', baseService: 'offers-service' },
    ];
    expect(getTotalWorkerMaxInstances(services)).toBe(6);
  });

  it('should return 0 when no workers exist', () => {
    const services = [
      { name: 'auth-service', type: 'nestjs', hasDatabase: true },
    ];
    expect(getTotalWorkerMaxInstances(services)).toBe(0);
  });

  it('should exclude workers whose base service has no database', () => {
    const services = [
      { name: 'auth-service', type: 'nestjs', hasDatabase: true },
      { name: 'bff-service', type: 'nestjs', hasDatabase: false },
      { name: 'auth-worker', type: 'worker', baseService: 'auth-service' },
      { name: 'bff-worker', type: 'worker', baseService: 'bff-service' },
    ];
    // Only auth-worker counts (base has db), bff-worker excluded
    expect(getTotalWorkerMaxInstances(services)).toBe(3);
  });

  it('should exclude workers with missing base service', () => {
    const services = [
      { name: 'auth-service', type: 'nestjs', hasDatabase: true },
      { name: 'orphan-worker', type: 'worker', baseService: 'nonexistent' },
    ];
    expect(getTotalWorkerMaxInstances(services)).toBe(0);
  });

  describe('with infrastructure config', () => {
    it('should use maxInstances from infrastructure.json when provided', () => {
      const services = [
        { name: 'auth-service', type: 'nestjs', hasDatabase: true },
        { name: 'auth-worker', type: 'worker', baseService: 'auth-service' },
      ];
      const infraConfig = {
        dev: {
          'auth-worker': { maxInstances: 5 },
        },
      };
      expect(
        getTotalWorkerMaxInstances(services, {
          infraConfig,
          targetEnv: 'dev',
        }),
      ).toBe(5);
    });

    it('should sum maxInstances across multiple workers', () => {
      const services = [
        { name: 'auth-service', type: 'nestjs', hasDatabase: true },
        { name: 'offers-service', type: 'nestjs', hasDatabase: true },
        { name: 'auth-worker', type: 'worker', baseService: 'auth-service' },
        {
          name: 'offers-worker',
          type: 'worker',
          baseService: 'offers-service',
        },
      ];
      const infraConfig = {
        dev: {
          'auth-worker': { maxInstances: 5 },
          'offers-worker': { maxInstances: 10 },
        },
      };
      expect(
        getTotalWorkerMaxInstances(services, {
          infraConfig,
          targetEnv: 'dev',
        }),
      ).toBe(15);
    });

    it('should fall back to default 3 for workers without override', () => {
      const services = [
        { name: 'auth-service', type: 'nestjs', hasDatabase: true },
        { name: 'offers-service', type: 'nestjs', hasDatabase: true },
        { name: 'auth-worker', type: 'worker', baseService: 'auth-service' },
        {
          name: 'offers-worker',
          type: 'worker',
          baseService: 'offers-service',
        },
      ];
      const infraConfig = {
        dev: {
          'auth-worker': { maxInstances: 7 },
          // offers-worker has no override → default 3
        },
      };
      expect(
        getTotalWorkerMaxInstances(services, {
          infraConfig,
          targetEnv: 'dev',
        }),
      ).toBe(10); // 7 + 3
    });

    it('should fall back to default when infraConfig is null', () => {
      const services = [
        { name: 'auth-service', type: 'nestjs', hasDatabase: true },
        { name: 'auth-worker', type: 'worker', baseService: 'auth-service' },
      ];
      expect(
        getTotalWorkerMaxInstances(services, {
          infraConfig: null,
          targetEnv: 'dev',
        }),
      ).toBe(3);
    });

    it('should fall back to default when environment not found', () => {
      const services = [
        { name: 'auth-service', type: 'nestjs', hasDatabase: true },
        { name: 'auth-worker', type: 'worker', baseService: 'auth-service' },
      ];
      const infraConfig = {
        staging: {
          'auth-worker': { maxInstances: 5 },
        },
      };
      expect(
        getTotalWorkerMaxInstances(services, {
          infraConfig,
          targetEnv: 'dev',
        }),
      ).toBe(3);
    });
  });
});
