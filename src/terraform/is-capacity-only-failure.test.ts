import { describe, it, expect } from '@rstest/core';
import { isCapacityOnlyFailure } from './is-capacity-only-failure';

// Output of a real Azure deploy (2026-10-21), shortened
const AZURE_POSTGRES_CAPACITY = `azurerm_private_endpoint.redis: Creation complete after 1m56s [id=/subscriptions/x/resourceGroups/rg/providers/Microsoft.Network/privateEndpoints/pe]
╷
│ Error: creating Flexible Server (Subscription: "x"
│ Resource Group Name: "rg"
│ Flexible Server Name: "app-dev-postgres"): polling after CreateOrUpdate: polling failed: the Azure API returned the following error:
│
│ Status: "RegionalAllocationFailed"
│ Code: ""
│ Message: "We do not have sufficient capacity for the requested compute size in this region."
│
│   with azurerm_postgresql_flexible_server.main,
│   on database.tf line 17, in resource "azurerm_postgresql_flexible_server" "main":
│   17: resource "azurerm_postgresql_flexible_server" "main" {
│
╵
Releasing state lock. This may take a few moments...`;

const AWS_RDS_CAPACITY = `╷
│ Error: creating RDS DB Instance (app-dev-db): operation error RDS: CreateDBInstance, https response error StatusCode: 400, RequestID: abc, InsufficientDBInstanceCapacity: Cannot create a database instance because there is no capacity in the requested Availability Zone.
│
│   with aws_db_instance.main,
╵`;

const AWS_ELASTICACHE_CAPACITY = `╷
│ Error: creating ElastiCache Replication Group (app-dev-redis): operation error ElastiCache: CreateReplicationGroup, https response error StatusCode: 400, InsufficientCacheClusterCapacity: cache.t4g.micro is not currently supported in the availability zone.
╵`;

const GCP_CLOUD_SQL_STOCKOUT = `╷
│ Error: Error waiting for Create Instance: [{"code":"ERROR_GCE_STOCKOUT","message":"The zone or region doesn't have sufficient resources to handle the request at the moment."}]
│
│   with google_sql_database_instance.main,
╵`;

const OTHER_ERROR = `╷
│ Error: creating Storage Account: StorageAccountAlreadyTaken: The storage account named appdevstorage is already taken.
│
│   with azurerm_storage_account.storage,
╵`;

describe('isCapacityOnlyFailure', () => {
  describe('Capacity errors', () => {
    it('should detect the Azure Postgres allocation failure', () => {
      expect(isCapacityOnlyFailure(AZURE_POSTGRES_CAPACITY, 'azure')).toBe(
        true,
      );
    });

    it('should detect Azure zonal and generic allocation failures', () => {
      expect(
        isCapacityOnlyFailure(
          '│ Error: x: Code="ZonalAllocationFailed"',
          'azure',
        ),
      ).toBe(true);
      expect(
        isCapacityOnlyFailure('│ Error: x: Code="AllocationFailed"', 'azure'),
      ).toBe(true);
    });

    it('should detect AWS RDS and ElastiCache capacity errors', () => {
      expect(isCapacityOnlyFailure(AWS_RDS_CAPACITY, 'aws')).toBe(true);
      expect(isCapacityOnlyFailure(AWS_ELASTICACHE_CAPACITY, 'aws')).toBe(true);
    });

    it('should detect a GCP Cloud SQL stockout by code or by message', () => {
      expect(isCapacityOnlyFailure(GCP_CLOUD_SQL_STOCKOUT, 'gcp')).toBe(true);
      expect(
        isCapacityOnlyFailure(
          '│ Error: x: The zone or region does not have sufficient resources to handle the request at the moment.',
          'gcp',
        ),
      ).toBe(true);
    });

    it('should detect several errors that are all capacity errors', () => {
      expect(
        isCapacityOnlyFailure(
          `${AWS_RDS_CAPACITY}\n${AWS_ELASTICACHE_CAPACITY}`,
          'aws',
        ),
      ).toBe(true);
    });

    it('should detect errors without the box frame', () => {
      expect(
        isCapacityOnlyFailure(
          'Error: creating Flexible Server: Status: "RegionalAllocationFailed"',
          'azure',
        ),
      ).toBe(true);
    });
  });

  describe('Not only capacity', () => {
    it('should be false when another error comes with a capacity error', () => {
      expect(
        isCapacityOnlyFailure(
          `${AZURE_POSTGRES_CAPACITY}\n${OTHER_ERROR}`,
          'azure',
        ),
      ).toBe(false);
    });

    it('should be false for an unrelated error', () => {
      expect(isCapacityOnlyFailure(OTHER_ERROR, 'azure')).toBe(false);
    });

    it('should be false when there is no error', () => {
      expect(
        isCapacityOnlyFailure('Apply complete! Resources: 3 added.', 'azure'),
      ).toBe(false);
      expect(isCapacityOnlyFailure('', 'gcp')).toBe(false);
    });

    it("should not match another provider's capacity codes", () => {
      expect(isCapacityOnlyFailure(AZURE_POSTGRES_CAPACITY, 'aws')).toBe(false);
      expect(isCapacityOnlyFailure(AWS_RDS_CAPACITY, 'gcp')).toBe(false);
    });

    it('should ignore warnings', () => {
      const warning = `╷\n│ Warning: Argument is deprecated\n│ Message: AllocationFailed in a sample\n╵`;
      expect(isCapacityOnlyFailure(warning, 'azure')).toBe(false);
    });

    it('should not match a longer code that ends in AllocationFailed', () => {
      expect(
        isCapacityOnlyFailure('│ Error: x: Code="IPAllocationFailed"', 'azure'),
      ).toBe(false);
    });
  });
});
