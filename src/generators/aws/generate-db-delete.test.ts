/**
 * Tests for generate-db-delete
 */

import { describe, it, expect } from '@rstest/core';
import { generateDbDelete } from './generate-db-delete';

describe('generateDbDelete', () => {
  describe('Standard use cases', () => {
    it('should generate all required files', () => {
      const result = generateDbDelete({ appRoleSuffix: '_app' });

      expect(result).toHaveProperty('dockerfile');
      expect(result).toHaveProperty('packageJson');
      expect(result).toHaveProperty('indexJs');
    });

    it('should generate valid Dockerfile', () => {
      const result = generateDbDelete({ appRoleSuffix: '_app' });

      expect(result.dockerfile).toContain('FROM node:22-alpine');
      expect(result.dockerfile).toContain('WORKDIR /app');
      expect(result.dockerfile).toContain('COPY package.json');
      expect(result.dockerfile).toContain('npm install --production');
      expect(result.dockerfile).toContain('COPY index.js');
      expect(result.dockerfile).toContain('CMD ["node", "index.js"]');
    });

    it('should generate valid package.json', () => {
      const result = generateDbDelete({ appRoleSuffix: '_app' });
      const pkg = JSON.parse(result.packageJson);

      expect(pkg.name).toBe('db-delete');
      expect(pkg.version).toBe('1.0.0');
      expect(pkg.private).toBe(true);
      expect(pkg.dependencies).toHaveProperty('pg');
    });

    it('should generate index.js with database deletion logic', () => {
      const result = generateDbDelete({ appRoleSuffix: '_app' });

      expect(result.indexJs).toContain('db-delete starting');
      expect(result.indexJs).toContain('DROP DATABASE IF EXISTS');
      expect(result.indexJs).toContain('DROP USER IF EXISTS');
      expect(result.indexJs).toContain('pg_terminate_backend');
      expect(result.indexJs).toContain('SERVICES');
    });

    it('should drop the owner and the app role, after the database', () => {
      const result = generateDbDelete({ appRoleSuffix: '_app' });

      expect(result.indexJs).toContain('const APP_ROLE_SUFFIX = "_app";');
      expect(result.indexJs).toContain(
        'for (const dbUser of [serviceName, serviceName + APP_ROLE_SUFFIX])',
      );
      expect(result.indexJs.indexOf('DROP DATABASE IF EXISTS')).toBeLessThan(
        result.indexJs.indexOf('DROP USER IF EXISTS'),
      );
    });
  });
});
