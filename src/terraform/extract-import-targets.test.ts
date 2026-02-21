import { describe, it, expect } from '@rstest/core';
import { extractImportTargets } from './extract-import-targets';

describe('extractImportTargets', () => {
  it('should extract single import target from terraform output', () => {
    const output = `
╷
│ Error: A resource with the ID "/subscriptions/8c97267a-cfe2-48a7-a429-d98f1e0f67a1/resourceGroups/tsdevstack-dev-rg/providers/Microsoft.Cdn/profiles/tsdevstack-dev-frontdoor/customDomains/tsdevstack-dev-app" already exists - to be managed via Terraform this resource needs to be imported into the State. Please use the functionality of "terraform import" to import this resource.
│
│   with azurerm_cdn_frontdoor_custom_domain.app,
│   on dns.tf line 42, in resource "azurerm_cdn_frontdoor_custom_domain" "app":
│   42: resource "azurerm_cdn_frontdoor_custom_domain" "app" {
│
╵`;

    const result = extractImportTargets(output);
    expect(result).toHaveLength(1);
    expect(result[0].address).toBe('azurerm_cdn_frontdoor_custom_domain.app');
    expect(result[0].resourceId).toBe(
      '/subscriptions/8c97267a-cfe2-48a7-a429-d98f1e0f67a1/resourceGroups/tsdevstack-dev-rg/providers/Microsoft.Cdn/profiles/tsdevstack-dev-frontdoor/customDomains/tsdevstack-dev-app',
    );
  });

  it('should extract multiple import targets', () => {
    const output = `
╷
│ Error: A resource with the ID "/subscriptions/xxx/resourceGroups/rg/providers/Microsoft.Cdn/profiles/fd/customDomains/app" already exists - to be managed via Terraform this resource needs to be imported into the State.
│
│   with azurerm_cdn_frontdoor_custom_domain.app,
│   on dns.tf line 42
│
╵
╷
│ Error: A resource with the ID "/subscriptions/xxx/resourceGroups/rg/providers/Microsoft.Cdn/profiles/fd/customDomains/spa-react-app" already exists - to be managed via Terraform this resource needs to be imported into the State.
│
│   with azurerm_cdn_frontdoor_custom_domain.spa_react_app,
│   on dns.tf line 60
│
╵`;

    const result = extractImportTargets(output);
    expect(result).toHaveLength(2);
    expect(result[0].address).toBe('azurerm_cdn_frontdoor_custom_domain.app');
    expect(result[1].address).toBe(
      'azurerm_cdn_frontdoor_custom_domain.spa_react_app',
    );
  });

  it('should return empty array when no "already exists" errors', () => {
    const output = 'Some other error message without import info';

    expect(extractImportTargets(output)).toEqual([]);
  });

  it('should return empty array for empty output', () => {
    expect(extractImportTargets('')).toEqual([]);
  });

  it('should handle mixed errors and only extract "already exists" targets', () => {
    const output = `
Error: Error acquiring the state lock

Lock Info:
  ID:        c7ea14eb-66e6-4f5e-3ee5-23bb545614f5

╷
│ Error: A resource with the ID "/subscriptions/xxx/providers/Microsoft.Cdn/profiles/fd/customDomains/api" already exists - to be managed via Terraform.
│
│   with azurerm_cdn_frontdoor_custom_domain.api,
│   on dns.tf line 10
│
╵

Error: deleting CDN FrontDoor Custom Domain: still associated with a route`;

    const result = extractImportTargets(output);
    expect(result).toHaveLength(1);
    expect(result[0].address).toBe('azurerm_cdn_frontdoor_custom_domain.api');
  });
});
