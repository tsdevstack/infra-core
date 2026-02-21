import { describe, it, expect } from '@rstest/core';
import { getMimeType } from './get-mime-type.ts';

describe('getMimeType', () => {
  describe('Web assets', () => {
    it('should return text/html for .html files', () => {
      expect(getMimeType('index.html')).toBe('text/html');
    });

    it('should return text/css for .css files', () => {
      expect(getMimeType('styles.css')).toBe('text/css');
    });

    it('should return application/javascript for .js files', () => {
      expect(getMimeType('main.js')).toBe('application/javascript');
    });

    it('should return application/json for .json files', () => {
      expect(getMimeType('config.json')).toBe('application/json');
    });
  });

  describe('Images', () => {
    it('should return image/png for .png files', () => {
      expect(getMimeType('logo.png')).toBe('image/png');
    });

    it('should return image/jpeg for .jpg files', () => {
      expect(getMimeType('photo.jpg')).toBe('image/jpeg');
    });

    it('should return image/svg+xml for .svg files', () => {
      expect(getMimeType('icon.svg')).toBe('image/svg+xml');
    });
  });

  describe('Fonts', () => {
    it('should return font/woff2 for .woff2 files', () => {
      expect(getMimeType('font.woff2')).toBe('font/woff2');
    });

    it('should return font/woff for .woff files', () => {
      expect(getMimeType('font.woff')).toBe('font/woff');
    });
  });

  describe('Case insensitivity', () => {
    it('should handle uppercase extensions', () => {
      expect(getMimeType('FILE.HTML')).toBe('text/html');
    });

    it('should handle mixed case extensions', () => {
      expect(getMimeType('image.PNG')).toBe('image/png');
    });
  });

  describe('Edge cases', () => {
    it('should return application/octet-stream for unknown extensions', () => {
      expect(getMimeType('file.xyz')).toBe('application/octet-stream');
    });

    it('should handle files with paths', () => {
      expect(getMimeType('/path/to/file.js')).toBe('application/javascript');
    });

    it('should handle files without extension', () => {
      expect(getMimeType('LICENSE')).toBe('application/octet-stream');
    });
  });
});
