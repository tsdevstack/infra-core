/**
 * Tests for get-total-service-max-instances utility
 */

import { describe, it, expect } from '@rstest/core';
import { getTotalServiceMaxInstances } from './get-total-service-max-instances';

describe('getTotalServiceMaxInstances', () => {
  const services = [
    { name: 'auth-service', type: 'nestjs', hasDatabase: true },
    { name: 'offers-service', type: 'nestjs', hasDatabase: true },
    { name: 'bff-service', type: 'nestjs', hasDatabase: false },
    { name: 'frontend', type: 'nextjs', hasDatabase: false },
    { name: 'react-app', type: 'spa', hasDatabase: false },
    { name: 'auth-worker', type: 'worker', baseService: 'auth-service' },
  ];

  const getMaxInstances = (serviceName: string): number =>
    serviceName === 'auth-service' ? 5 : 3;

  it('should sum maxInstances for services with hasDatabase true', () => {
    // auth-service (5) + offers-service (3) = 8
    const result = getTotalServiceMaxInstances(services, getMaxInstances);
    expect(result).toBe(8);
  });

  it('should exclude nestjs services without database', () => {
    // bff-service has hasDatabase: false — not counted
    const result = getTotalServiceMaxInstances(services, getMaxInstances);
    expect(result).toBe(8);
  });

  it('should exclude workers', () => {
    // auth-worker is pool-relevant but counted by getTotalWorkerMaxInstances
    const result = getTotalServiceMaxInstances(services, getMaxInstances);
    expect(result).toBe(8);
  });

  it('should exclude SPAs and frontends without database', () => {
    const result = getTotalServiceMaxInstances(services, getMaxInstances);
    expect(result).toBe(8);
  });

  it('should return 0 when no services have database', () => {
    const noDbServices = [
      { name: 'bff-service', type: 'nestjs', hasDatabase: false },
      { name: 'frontend', type: 'nextjs', hasDatabase: false },
    ];
    const result = getTotalServiceMaxInstances(noDbServices, getMaxInstances);
    expect(result).toBe(0);
  });
});
