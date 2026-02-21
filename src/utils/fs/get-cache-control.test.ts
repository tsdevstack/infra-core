import { describe, it, expect } from '@rstest/core';
import { getCacheControl } from './get-cache-control.ts';

describe('getCacheControl', () => {
  describe('index.html', () => {
    it('should return no-cache for index.html', () => {
      expect(getCacheControl('index.html')).toBe('no-cache, must-revalidate');
    });

    it('should return no-cache for nested index.html', () => {
      expect(getCacheControl('/path/to/index.html')).toBe(
        'no-cache, must-revalidate',
      );
    });
  });

  describe('Hashed assets', () => {
    it('should return immutable for Vite-style hashed JS', () => {
      expect(getCacheControl('main.a1b2c3d4.js')).toBe(
        'public, max-age=31536000, immutable',
      );
    });

    it('should return immutable for webpack-style hashed CSS', () => {
      expect(getCacheControl('chunk-vendors.5e6f7a8b.css')).toBe(
        'public, max-age=31536000, immutable',
      );
    });

    it('should return immutable for dash-separated hashed files', () => {
      expect(getCacheControl('index-abcd1234.js')).toBe(
        'public, max-age=31536000, immutable',
      );
    });

    it('should return immutable for hashed fonts', () => {
      expect(getCacheControl('font.abc12345.woff2')).toBe(
        'public, max-age=31536000, immutable',
      );
    });

    it('should handle long hashes', () => {
      expect(getCacheControl('app.a1b2c3d4e5f60a8b.js')).toBe(
        'public, max-age=31536000, immutable',
      );
    });
  });

  describe('Default caching', () => {
    it('should return 1 day cache for non-hashed JS', () => {
      expect(getCacheControl('app.js')).toBe('public, max-age=86400');
    });

    it('should return 1 day cache for images', () => {
      expect(getCacheControl('logo.png')).toBe('public, max-age=86400');
    });

    it('should return 1 day cache for favicon', () => {
      expect(getCacheControl('favicon.ico')).toBe('public, max-age=86400');
    });
  });

  describe('Edge cases', () => {
    it('should handle paths with directories', () => {
      expect(getCacheControl('/assets/js/main.abc12345.js')).toBe(
        'public, max-age=31536000, immutable',
      );
    });

    it('should not match short hashes (less than 8 chars)', () => {
      expect(getCacheControl('main.abc.js')).toBe('public, max-age=86400');
    });
  });
});
