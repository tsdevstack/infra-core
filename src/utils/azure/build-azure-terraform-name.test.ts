import { describe, it, expect } from '@rstest/core';
import { buildAzureTerraformName } from './build-azure-terraform-name';

const config = {
  projectName: 'shop',
  environment: 'dev',
  subscriptionId: '00000000-0000-0000-0000-000000000000',
};
const LEGACY_KONG = '"${var.project_name}-${var.environment}-kong"';

describe('buildAzureTerraformName', () => {
  describe('Standard use cases', () => {
    it("should keep a legacy environment's expression as it is", () => {
      expect(
        buildAzureTerraformName(
          { ...config, naming: 'legacy' },
          'appService',
          LEGACY_KONG,
          'kong',
        ),
      ).toBe(LEGACY_KONG);
    });

    it('should write the full name in the unique scheme', () => {
      expect(
        buildAzureTerraformName(
          { ...config, naming: 'unique' },
          'appService',
          LEGACY_KONG,
          'kong',
        ),
      ).toBe('"shop-dev-kong-12b937"');
    });
  });
});
