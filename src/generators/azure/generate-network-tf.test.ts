import { describe, it, expect } from '@rstest/core';
import { generateNetworkTf } from './generate-network-tf';

describe('generateNetworkTf', () => {
  describe('VNet resource', () => {
    it('should create VNet resource', () => {
      const result = generateNetworkTf();
      expect(result).toContain('resource "azurerm_virtual_network" "main"');
    });

    it('should use 10.0.0.0/16 address space', () => {
      const result = generateNetworkTf();
      expect(result).toContain('address_space       = ["10.0.0.0/16"]');
    });

    it('should reference resource group data source', () => {
      const result = generateNetworkTf();
      expect(result).toContain(
        'resource_group_name = data.azurerm_resource_group.main.name',
      );
      expect(result).toContain(
        'location            = data.azurerm_resource_group.main.location',
      );
    });

    it('should apply tags', () => {
      const result = generateNetworkTf();
      // Extract the VNet block and check it contains tags
      const vnetBlock = result.slice(
        result.indexOf('resource "azurerm_virtual_network" "main"'),
        result.indexOf('resource "azurerm_subnet"'),
      );
      expect(vnetBlock).toContain('tags                = local.tags');
    });
  });

  describe('Container Apps subnet', () => {
    it('should create container apps subnet', () => {
      const result = generateNetworkTf();
      expect(result).toContain('resource "azurerm_subnet" "container_apps"');
    });

    it('should use /23 CIDR (minimum for Consumption plan)', () => {
      const result = generateNetworkTf();
      expect(result).toContain('address_prefixes     = ["10.0.0.0/23"]');
    });

    it('should delegate to Microsoft.App/environments', () => {
      const result = generateNetworkTf();
      expect(result).toContain('name    = "Microsoft.App/environments"');
    });
  });

  describe('PostgreSQL subnet', () => {
    it('should create postgres subnet', () => {
      const result = generateNetworkTf();
      expect(result).toContain('resource "azurerm_subnet" "postgres"');
    });

    it('should use /28 CIDR', () => {
      const result = generateNetworkTf();
      expect(result).toContain('address_prefixes     = ["10.0.2.0/28"]');
    });

    it('should delegate to Microsoft.DBforPostgreSQL/flexibleServers', () => {
      const result = generateNetworkTf();
      expect(result).toContain(
        'name    = "Microsoft.DBforPostgreSQL/flexibleServers"',
      );
    });
  });

  describe('Private endpoints subnet', () => {
    it('should create private endpoints subnet', () => {
      const result = generateNetworkTf();
      expect(result).toContain('resource "azurerm_subnet" "private_endpoints"');
    });

    it('should use /28 CIDR', () => {
      const result = generateNetworkTf();
      expect(result).toContain('address_prefixes     = ["10.0.3.0/28"]');
    });

    it('should not have delegation', () => {
      const result = generateNetworkTf();
      // Extract the private_endpoints subnet block (ends at next resource)
      const peStart = result.indexOf(
        'resource "azurerm_subnet" "private_endpoints"',
      );
      const peEnd = result.indexOf(
        'resource "azurerm_subnet" "app_service_integration"',
      );
      const peBlock = result.slice(peStart, peEnd);
      expect(peBlock).not.toContain('delegation');
    });
  });

  describe('App Service integration subnet', () => {
    it('should create app service integration subnet', () => {
      const result = generateNetworkTf();
      expect(result).toContain(
        'resource "azurerm_subnet" "app_service_integration"',
      );
    });

    it('should use /25 CIDR at 10.0.4.0', () => {
      const result = generateNetworkTf();
      expect(result).toContain('address_prefixes     = ["10.0.4.0/25"]');
    });

    it('should delegate to Microsoft.Web/serverFarms', () => {
      const result = generateNetworkTf();
      expect(result).toContain('name    = "Microsoft.Web/serverFarms"');
    });

    it('should include join action in delegation', () => {
      const result = generateNetworkTf();
      const asSubnetStart = result.indexOf(
        'resource "azurerm_subnet" "app_service_integration"',
      );
      const asSubnetEnd = result.indexOf('# Private DNS Zones', asSubnetStart);
      const asBlock = result.slice(asSubnetStart, asSubnetEnd);
      expect(asBlock).toContain(
        'actions = ["Microsoft.Network/virtualNetworks/subnets/action"]',
      );
    });
  });

  describe('DNS zones', () => {
    it('should create PostgreSQL DNS zone', () => {
      const result = generateNetworkTf();
      expect(result).toContain(
        'resource "azurerm_private_dns_zone" "postgres"',
      );
      expect(result).toContain('private.postgres.database.azure.com');
    });

    it('should create Redis DNS zone for Managed Redis (not Cache for Redis)', () => {
      const result = generateNetworkTf();
      expect(result).toContain('resource "azurerm_private_dns_zone" "redis"');
      expect(result).toContain('privatelink.redis.azure.net');
      // Must NOT use Cache for Redis zone
      expect(result).not.toContain('privatelink.redis.cache.windows.net');
    });

    it('should create Container Apps DNS zone using CAE default domain', () => {
      const result = generateNetworkTf();
      expect(result).toContain(
        'resource "azurerm_private_dns_zone" "container_apps"',
      );
      expect(result).toContain(
        'name                = azurerm_container_app_environment.main.default_domain',
      );
    });

    it('should create wildcard A record for Container Apps DNS zone', () => {
      const result = generateNetworkTf();
      expect(result).toContain(
        'resource "azurerm_private_dns_a_record" "container_apps_wildcard"',
      );
      expect(result).toContain(
        'records             = [azurerm_container_app_environment.main.static_ip_address]',
      );
    });

    it('should apply tags to DNS zones', () => {
      const result = generateNetworkTf();
      const postgresZoneStart = result.indexOf(
        'resource "azurerm_private_dns_zone" "postgres"',
      );
      const redisZoneStart = result.indexOf(
        'resource "azurerm_private_dns_zone" "redis"',
      );
      const linksStart = result.indexOf('# DNS Zone VNet Links');

      const postgresZone = result.slice(postgresZoneStart, redisZoneStart);
      const redisZone = result.slice(redisZoneStart, linksStart);

      expect(postgresZone).toContain('tags                = local.tags');
      expect(redisZone).toContain('tags                = local.tags');
    });
  });

  describe('DNS VNet links', () => {
    it('should create PostgreSQL DNS VNet link', () => {
      const result = generateNetworkTf();
      expect(result).toContain(
        'resource "azurerm_private_dns_zone_virtual_network_link" "postgres"',
      );
    });

    it('should create Redis DNS VNet link', () => {
      const result = generateNetworkTf();
      expect(result).toContain(
        'resource "azurerm_private_dns_zone_virtual_network_link" "redis"',
      );
    });

    it('should create Container Apps DNS VNet link', () => {
      const result = generateNetworkTf();
      expect(result).toContain(
        'resource "azurerm_private_dns_zone_virtual_network_link" "container_apps"',
      );
    });

    it('should link to VNet', () => {
      const result = generateNetworkTf();
      expect(result).toContain(
        'virtual_network_id    = azurerm_virtual_network.main.id',
      );
    });

    it('should disable registration', () => {
      const result = generateNetworkTf();
      expect(result).toContain('registration_enabled  = false');
    });

    it('should apply tags to DNS VNet links', () => {
      const result = generateNetworkTf();
      const linksStart = result.indexOf('# DNS Zone VNet Links');
      const nsgStart = result.indexOf('# Network Security Group');
      const linksBlock = result.slice(linksStart, nsgStart);

      // All links and zones should have tags (postgres, redis, container_apps zone, container_apps link)
      const tagMatches = linksBlock.match(/tags\s+=\s+local\.tags/g);
      expect(tagMatches).toHaveLength(4);
    });
  });

  describe('Network Security Group', () => {
    it('should create NSG resource with correct name', () => {
      const result = generateNetworkTf();
      expect(result).toContain(
        'resource "azurerm_network_security_group" "container_apps"',
      );
      expect(result).toContain('-cae-nsg');
    });

    it('should not include AllowFrontDoor rule (ILB has no public IP)', () => {
      const result = generateNetworkTf();
      expect(result).not.toContain(
        'resource "azurerm_network_security_rule" "allow_frontdoor"',
      );
    });

    it('should allow inbound from AzureLoadBalancer for health probes', () => {
      const result = generateNetworkTf();
      expect(result).toContain(
        'resource "azurerm_network_security_rule" "allow_lb"',
      );
      expect(result).toContain(
        'source_address_prefix       = "AzureLoadBalancer"',
      );
      expect(result).toContain('priority                    = 110');
    });

    it('should allow internal VNet traffic', () => {
      const result = generateNetworkTf();
      expect(result).toContain(
        'resource "azurerm_network_security_rule" "allow_vnet"',
      );
      expect(result).toContain(
        'source_address_prefix       = "VirtualNetwork"',
      );
      expect(result).toContain(
        'destination_address_prefix  = "VirtualNetwork"',
      );
      expect(result).toContain('priority                    = 120');
    });

    it('should deny all other inbound at priority 1000', () => {
      const result = generateNetworkTf();
      expect(result).toContain(
        'resource "azurerm_network_security_rule" "deny_all_inbound"',
      );
      expect(result).toContain('priority                    = 1000');
      expect(result).toContain('access                      = "Deny"');
    });

    it('should associate NSG with Container Apps subnet', () => {
      const result = generateNetworkTf();
      expect(result).toContain(
        'resource "azurerm_subnet_network_security_group_association" "container_apps"',
      );
      expect(result).toContain(
        'subnet_id                 = azurerm_subnet.container_apps.id',
      );
      expect(result).toContain(
        'network_security_group_id = azurerm_network_security_group.container_apps.id',
      );
    });

    it('should include description on all NSG rules', () => {
      const result = generateNetworkTf();
      const nsgSection = result.slice(
        result.indexOf('resource "azurerm_network_security_rule"'),
      );
      const descriptionMatches = nsgSection.match(/description\s+=/g);
      expect(descriptionMatches).toHaveLength(3);
    });

    it('should apply tags to NSG', () => {
      const result = generateNetworkTf();
      const nsgBlock = result.slice(
        result.indexOf(
          'resource "azurerm_network_security_group" "container_apps"',
        ),
        result.indexOf('resource "azurerm_network_security_rule"'),
      );
      expect(nsgBlock).toContain('tags                = local.tags');
    });
  });

  describe('header comment', () => {
    it('should include generation comment', () => {
      const result = generateNetworkTf();
      expect(result).toContain('Generated by: npx tsdevstack infra:generate');
    });
  });
});
