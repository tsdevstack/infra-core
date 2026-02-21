import { describe, it, expect } from '@rstest/core';
import { parseImageUri } from './parse-image-uri.ts';

describe('parseImageUri', () => {
  describe('Standard formats', () => {
    it('should parse Artifact Registry URI with tag', () => {
      const result = parseImageUri(
        'us-central1-docker.pkg.dev/my-project/my-repo/my-image:v1.0.0',
      );

      expect(result).toEqual({
        registry: 'us-central1-docker.pkg.dev',
        repository: 'my-project/my-repo/my-image',
        tag: 'v1.0.0',
      });
    });

    it('should parse URI with commit SHA tag', () => {
      const result = parseImageUri(
        'us-central1-docker.pkg.dev/project/repo/image:abc123def',
      );

      expect(result).toEqual({
        registry: 'us-central1-docker.pkg.dev',
        repository: 'project/repo/image',
        tag: 'abc123def',
      });
    });

    it('should parse Docker Hub style URI', () => {
      const result = parseImageUri('docker.io/library/nginx:1.21');

      expect(result).toEqual({
        registry: 'docker.io',
        repository: 'library/nginx',
        tag: '1.21',
      });
    });
  });

  describe('Missing tag', () => {
    it('should default to latest when no tag specified', () => {
      const result = parseImageUri(
        'us-central1-docker.pkg.dev/project/repo/image',
      );

      expect(result).toEqual({
        registry: 'us-central1-docker.pkg.dev',
        repository: 'project/repo/image',
        tag: 'latest',
      });
    });
  });

  describe('Edge cases', () => {
    it('should handle nested repository paths', () => {
      const result = parseImageUri('gcr.io/project/team/service/app:prod');

      expect(result).toEqual({
        registry: 'gcr.io',
        repository: 'project/team/service/app',
        tag: 'prod',
      });
    });

    it('should handle tag with colons in port numbers (unlikely but valid)', () => {
      // This tests that we use lastIndexOf for colon
      const result = parseImageUri('localhost:5000/myimage:tag');

      expect(result).toEqual({
        registry: 'localhost:5000',
        repository: 'myimage',
        tag: 'tag',
      });
    });
  });
});
