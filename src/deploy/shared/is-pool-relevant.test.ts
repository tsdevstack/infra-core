/**
 * Tests for is-pool-relevant utility
 */

import { describe, it, expect } from '@rstest/core';
import { isPoolRelevant } from './is-pool-relevant';

describe('isPoolRelevant', () => {
  const allServices = [
    { name: 'auth-service', type: 'nestjs', hasDatabase: true },
    { name: 'bff-service', type: 'nestjs', hasDatabase: false },
    { name: 'frontend', type: 'nextjs', hasDatabase: false },
    { name: 'react-app', type: 'spa', hasDatabase: false },
    { name: 'auth-worker', type: 'worker', baseService: 'auth-service' },
    { name: 'bff-worker', type: 'worker', baseService: 'bff-service' },
  ];

  it('should return true for nestjs service with database', () => {
    const service = allServices.find((s) => s.name === 'auth-service')!;
    expect(isPoolRelevant(service, allServices)).toBe(true);
  });

  it('should return false for nestjs service without database', () => {
    const service = allServices.find((s) => s.name === 'bff-service')!;
    expect(isPoolRelevant(service, allServices)).toBe(false);
  });

  it('should return false for nextjs service', () => {
    const service = allServices.find((s) => s.name === 'frontend')!;
    expect(isPoolRelevant(service, allServices)).toBe(false);
  });

  it('should return false for spa service', () => {
    const service = allServices.find((s) => s.name === 'react-app')!;
    expect(isPoolRelevant(service, allServices)).toBe(false);
  });

  it('should return true for worker whose base service has database', () => {
    const service = allServices.find((s) => s.name === 'auth-worker')!;
    expect(isPoolRelevant(service, allServices)).toBe(true);
  });

  it('should return false for worker whose base service has no database', () => {
    const service = allServices.find((s) => s.name === 'bff-worker')!;
    expect(isPoolRelevant(service, allServices)).toBe(false);
  });

  it('should return false for worker with missing base service', () => {
    const orphanWorker = {
      name: 'orphan-worker',
      type: 'worker',
      baseService: 'nonexistent',
    };
    expect(isPoolRelevant(orphanWorker, allServices)).toBe(false);
  });

  it('should return false for worker without baseService field', () => {
    const badWorker = { name: 'bad-worker', type: 'worker' };
    expect(isPoolRelevant(badWorker, allServices)).toBe(false);
  });
});
