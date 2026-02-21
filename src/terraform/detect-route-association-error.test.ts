import { describe, it, expect } from '@rstest/core';
import { detectRouteAssociationError } from './detect-route-association-error';

describe('detectRouteAssociationError', () => {
  it('should detect "associated with a route" error', () => {
    const output = `
╷
│ Error: deleting CDN FrontDoor Custom Domain (Subscription: "8c97267a-cfe2-48a7-a429-d98f1e0f67a1"
│ / Resource Group Name "tsdevstack-dev-rg"): performing Delete: This resource is still associated with a route.
│ Please remove the association with the route first.
│
│   with azurerm_cdn_frontdoor_custom_domain.app,
│   on dns.tf line 42
│
╵`;

    expect(detectRouteAssociationError(output)).toBe(true);
  });

  it('should return false for unrelated errors', () => {
    const output =
      'Error: creating CDN FrontDoor Custom Domain: quota exceeded';

    expect(detectRouteAssociationError(output)).toBe(false);
  });

  it('should return false for empty output', () => {
    expect(detectRouteAssociationError('')).toBe(false);
  });

  it('should detect error with varied formatting', () => {
    const output =
      'Error: the custom domain is still associated with a route and cannot be deleted';

    expect(detectRouteAssociationError(output)).toBe(true);
  });
});
