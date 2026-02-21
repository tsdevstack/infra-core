import { describe, it, expect } from '@rstest/core';
import { fromServiceEnvVarName } from './from-service-env-var-name';

describe('fromServiceEnvVarName', () => {
  it('should convert AUTH_SERVICE to auth-service', () => {
    expect(fromServiceEnvVarName('AUTH_SERVICE')).toBe('auth-service');
  });

  it('should convert OFFERS_SERVICE to offers-service', () => {
    expect(fromServiceEnvVarName('OFFERS_SERVICE')).toBe('offers-service');
  });

  it('should convert BFF_SERVICE to bff-service', () => {
    expect(fromServiceEnvVarName('BFF_SERVICE')).toBe('bff-service');
  });

  it('should handle single word', () => {
    expect(fromServiceEnvVarName('KONG')).toBe('kong');
  });
});
