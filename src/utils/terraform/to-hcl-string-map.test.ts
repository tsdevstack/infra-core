import { describe, it, expect } from '@rstest/core';
import { toHclStringMap } from './to-hcl-string-map';

describe('toHclStringMap', () => {
  describe('Standard use cases', () => {
    it('should format one entry per line', () => {
      expect(
        toHclStringMap({
          'auth-service': 'shop-dev-auth-service',
          'bff-service': 'shop-dev-bff-service',
        }),
      ).toBe(
        '{\n  "auth-service" = "shop-dev-auth-service"\n  "bff-service" = "shop-dev-bff-service"\n}',
      );
    });
  });

  describe('Edge cases', () => {
    it('should return an empty map for an empty record', () => {
      expect(toHclStringMap({})).toBe('{}');
    });

    it('should escape quotes and interpolation sequences', () => {
      expect(toHclStringMap({ 'a"b': '${x}' })).toBe(
        '{\n  "a\\"b" = "$${x}"\n}',
      );
    });
  });
});
