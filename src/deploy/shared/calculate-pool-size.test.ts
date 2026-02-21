/**
 * Tests for calculate-pool-size utility
 *
 * Flat split model: totalUsable / totalInstances — same poolMax for everyone.
 */

import { describe, it, expect } from '@rstest/core';
import { calculatePoolSize } from './calculate-pool-size';
import { InfraCoreError } from '../../runtime/infra-core-error.ts';

describe('calculatePoolSize', () => {
  describe('GCP calculations', () => {
    it('should calculate for db-f1-micro with 3 services x 3 max, no workers', () => {
      // totalUsable = floor(25 * 0.90) = 22, totalInstances = 9, poolMax = floor(22/9) = 2
      const result = calculatePoolSize({
        dbTier: 'db-f1-micro',
        provider: 'gcp',
        totalServiceMaxInstances: 9,
        totalWorkerMaxInstances: 0,
      });
      expect(result.poolMax).toBe(2);
      expect(result.totalUsable).toBe(22);
      expect(result.totalInstances).toBe(9);
      expect(result.dbConnections).toBe(25);
    });

    it('should calculate for db-f1-micro with 3 services x 3 max, 1 worker (x 3)', () => {
      // totalUsable = 22, totalInstances = 12, poolMax = floor(22/12) = 1
      const result = calculatePoolSize({
        dbTier: 'db-f1-micro',
        provider: 'gcp',
        totalServiceMaxInstances: 9,
        totalWorkerMaxInstances: 3,
      });
      expect(result.poolMax).toBe(1);
      expect(result.totalInstances).toBe(12);
    });

    it('should calculate for db-n1-standard-1 with larger setup', () => {
      // totalUsable = floor(100 * 0.90) = 90, totalInstances = 15, poolMax = floor(90/15) = 6
      const result = calculatePoolSize({
        dbTier: 'db-n1-standard-1',
        provider: 'gcp',
        totalServiceMaxInstances: 9,
        totalWorkerMaxInstances: 6,
      });
      expect(result.poolMax).toBe(6);
    });
  });

  describe('AWS calculations', () => {
    it('should calculate for db.t3.micro with 5 services x 3 max, 1 worker (x 3)', () => {
      // totalUsable = floor(112 * 0.90) = 100, totalInstances = 18, poolMax = floor(100/18) = 5
      const result = calculatePoolSize({
        dbTier: 'db.t3.micro',
        provider: 'aws',
        totalServiceMaxInstances: 15,
        totalWorkerMaxInstances: 3,
      });
      expect(result.poolMax).toBe(5);
      expect(result.totalUsable).toBe(100);
      expect(result.dbConnections).toBe(112);
    });

    it('should calculate for db.t3.medium with no workers', () => {
      // totalUsable = floor(450 * 0.90) = 405, totalInstances = 15, poolMax = floor(405/15) = 27
      const result = calculatePoolSize({
        dbTier: 'db.t3.medium',
        provider: 'aws',
        totalServiceMaxInstances: 15,
        totalWorkerMaxInstances: 0,
      });
      expect(result.poolMax).toBe(27);
    });
  });

  describe('Azure calculations', () => {
    it('should calculate for B_Standard_B1ms with 3 services x 3 max, 1 worker (x 3)', () => {
      // totalUsable = floor(50 * 0.90) = 45, totalInstances = 12, poolMax = floor(45/12) = 3
      const result = calculatePoolSize({
        dbTier: 'B_Standard_B1ms',
        provider: 'azure',
        totalServiceMaxInstances: 9,
        totalWorkerMaxInstances: 3,
      });
      expect(result.poolMax).toBe(3);
      expect(result.totalUsable).toBe(45);
    });

    it('should calculate for B_Standard_B2s with 3 services x 3 max, 2 workers (x 3 each)', () => {
      // totalUsable = floor(429 * 0.90) = 386, totalInstances = 15, poolMax = floor(386/15) = 25
      const result = calculatePoolSize({
        dbTier: 'B_Standard_B2s',
        provider: 'azure',
        totalServiceMaxInstances: 9,
        totalWorkerMaxInstances: 6,
      });
      expect(result.poolMax).toBe(25);
      expect(result.totalInstances).toBe(15);
    });

    it('should calculate for B_Standard_B1ms with no workers', () => {
      // totalUsable = 45, totalInstances = 9, poolMax = floor(45/9) = 5
      const result = calculatePoolSize({
        dbTier: 'B_Standard_B1ms',
        provider: 'azure',
        totalServiceMaxInstances: 9,
        totalWorkerMaxInstances: 0,
      });
      expect(result.poolMax).toBe(5);
    });
  });

  describe('edge cases', () => {
    it('should enforce minimum poolMax of 1', () => {
      // totalUsable = 45, totalInstances = 59, poolMax = floor(45/59) = 0 -> clamped to 1
      const result = calculatePoolSize({
        dbTier: 'B_Standard_B1ms',
        provider: 'azure',
        totalServiceMaxInstances: 50,
        totalWorkerMaxInstances: 9,
      });
      expect(result.poolMax).toBe(1);
    });
  });

  describe('error cases', () => {
    it('should throw for unknown database tier', () => {
      expect(() =>
        calculatePoolSize({
          dbTier: 'unknown-tier',
          provider: 'gcp',
          totalServiceMaxInstances: 9,
          totalWorkerMaxInstances: 0,
        }),
      ).toThrow('Unknown database tier: unknown-tier');
    });

    it('should throw InfraCoreError for unknown database tier', () => {
      expect(() =>
        calculatePoolSize({
          dbTier: 'unknown-tier',
          provider: 'gcp',
          totalServiceMaxInstances: 9,
          totalWorkerMaxInstances: 0,
        }),
      ).toThrow(InfraCoreError);
    });

    it('should throw when total instances is zero', () => {
      expect(() =>
        calculatePoolSize({
          dbTier: 'db-f1-micro',
          provider: 'gcp',
          totalServiceMaxInstances: 0,
          totalWorkerMaxInstances: 0,
        }),
      ).toThrow('No pool-relevant instances found');
    });
  });
});
