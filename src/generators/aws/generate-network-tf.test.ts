import { describe, it, expect } from '@rstest/core';
import { generateNetworkTf } from './generate-network-tf';

describe('generateNetworkTf', () => {
  describe('VPC', () => {
    it('should create VPC resource', () => {
      const result = generateNetworkTf();
      expect(result).toContain('resource "aws_vpc" "main"');
    });

    it('should use 10.0.0.0/16 CIDR block', () => {
      const result = generateNetworkTf();
      expect(result).toContain('cidr_block           = "10.0.0.0/16"');
    });

    it('should enable DNS hostnames and support', () => {
      const result = generateNetworkTf();
      expect(result).toContain('enable_dns_hostnames = true');
      expect(result).toContain('enable_dns_support   = true');
    });
  });

  describe('availability zones', () => {
    it('should lookup available AZs', () => {
      const result = generateNetworkTf();
      expect(result).toContain('data "aws_availability_zones" "available"');
      expect(result).toContain('state = "available"');
    });
  });

  describe('subnets', () => {
    it('should create 2 public subnets', () => {
      const result = generateNetworkTf();
      expect(result).toContain('resource "aws_subnet" "public"');
      expect(result).toContain('count                   = 2');
    });

    it('should create 2 private subnets', () => {
      const result = generateNetworkTf();
      expect(result).toContain('resource "aws_subnet" "private"');
    });

    it('should map public IPs on public subnets', () => {
      const result = generateNetworkTf();
      expect(result).toContain('map_public_ip_on_launch = true');
    });
  });

  describe('internet gateway', () => {
    it('should create internet gateway', () => {
      const result = generateNetworkTf();
      expect(result).toContain('resource "aws_internet_gateway" "main"');
    });
  });

  describe('NAT gateway', () => {
    it('should create elastic IP for NAT', () => {
      const result = generateNetworkTf();
      expect(result).toContain('resource "aws_eip" "nat"');
      expect(result).toContain('domain = "vpc"');
    });

    it('should create single NAT gateway', () => {
      const result = generateNetworkTf();
      expect(result).toContain('resource "aws_nat_gateway" "main"');
    });

    it('should place NAT gateway in public subnet', () => {
      const result = generateNetworkTf();
      expect(result).toContain('subnet_id     = aws_subnet.public[0].id');
    });
  });

  describe('route tables', () => {
    it('should create public route table with internet gateway', () => {
      const result = generateNetworkTf();
      expect(result).toContain('resource "aws_route_table" "public"');
      expect(result).toContain('gateway_id = aws_internet_gateway.main.id');
    });

    it('should create private route table with NAT gateway', () => {
      const result = generateNetworkTf();
      expect(result).toContain('resource "aws_route_table" "private"');
      expect(result).toContain('nat_gateway_id = aws_nat_gateway.main.id');
    });

    it('should associate subnets with route tables', () => {
      const result = generateNetworkTf();
      expect(result).toContain(
        'resource "aws_route_table_association" "public"',
      );
      expect(result).toContain(
        'resource "aws_route_table_association" "private"',
      );
    });
  });

  describe('security groups', () => {
    it('should create ALB security group', () => {
      const result = generateNetworkTf();
      expect(result).toContain('resource "aws_security_group" "alb"');
    });

    it('should allow HTTPS (443) on ALB (protected by origin header validation)', () => {
      const result = generateNetworkTf();
      expect(result).toContain('from_port   = 443');
      expect(result).toContain('to_port     = 443');
      expect(result).toContain('protected by origin header validation');
    });

    it('should allow HTTP (80) on ALB for redirect', () => {
      const result = generateNetworkTf();
      expect(result).toContain('from_port   = 80');
      expect(result).toContain('to_port     = 80');
      expect(result).toContain('HTTP redirect to HTTPS');
    });

    it('should allow internal HTTPS (8443) for Kong upstream routing', () => {
      const result = generateNetworkTf();
      expect(result).toContain('from_port   = 8443');
      expect(result).toContain('to_port     = 8443');
    });

    it('should allow internal HTTP (8080) for Kong OIDC discovery', () => {
      const result = generateNetworkTf();
      expect(result).toContain('from_port   = 8080');
      expect(result).toContain('to_port     = 8080');
    });

    it('should create ECS security group', () => {
      const result = generateNetworkTf();
      expect(result).toContain('resource "aws_security_group" "ecs"');
    });

    it('should create RDS security group', () => {
      const result = generateNetworkTf();
      expect(result).toContain('resource "aws_security_group" "rds"');
    });

    it('should allow PostgreSQL (5432) from ECS', () => {
      const result = generateNetworkTf();
      expect(result).toContain('from_port       = 5432');
      expect(result).toContain('to_port         = 5432');
    });

    it('should create Redis security group', () => {
      const result = generateNetworkTf();
      expect(result).toContain('resource "aws_security_group" "redis"');
    });

    it('should allow Redis (6379) from ECS', () => {
      const result = generateNetworkTf();
      expect(result).toContain('from_port       = 6379');
      expect(result).toContain('to_port         = 6379');
    });
  });

  describe('VPC endpoints', () => {
    it('should create S3 gateway endpoint', () => {
      const result = generateNetworkTf();
      expect(result).toContain('resource "aws_vpc_endpoint" "s3"');
      expect(result).toContain(
        'service_name      = "com.amazonaws.${var.aws_region}.s3"',
      );
    });

    it('should create DynamoDB gateway endpoint', () => {
      const result = generateNetworkTf();
      expect(result).toContain('resource "aws_vpc_endpoint" "dynamodb"');
      expect(result).toContain(
        'service_name      = "com.amazonaws.${var.aws_region}.dynamodb"',
      );
    });

    it('should use Gateway endpoint type', () => {
      const result = generateNetworkTf();
      expect(result).toContain('vpc_endpoint_type = "Gateway"');
    });
  });

  describe('Cloud Map service discovery', () => {
    it('should create private DNS namespace', () => {
      const result = generateNetworkTf();
      expect(result).toContain(
        'resource "aws_service_discovery_private_dns_namespace" "main"',
      );
    });

    it('should use project_name.local as namespace', () => {
      const result = generateNetworkTf();
      expect(result).toContain('name        = "${var.project_name}.local"');
    });

    it('should create service discovery services for non-Kong services', () => {
      const result = generateNetworkTf();
      expect(result).toContain(
        'resource "aws_service_discovery_service" "service"',
      );
      expect(result).toContain(
        'for_each = { for name, cfg in var.services : name => cfg if name != "kong" }',
      );
    });

    it('should use MULTIVALUE routing policy', () => {
      const result = generateNetworkTf();
      expect(result).toContain('routing_policy = "MULTIVALUE"');
    });

    it('should configure DNS A records with TTL 10', () => {
      const result = generateNetworkTf();
      expect(result).toContain('ttl  = 10');
      expect(result).toContain('type = "A"');
    });
  });

  describe('header comment', () => {
    it('should include generation comment', () => {
      const result = generateNetworkTf();
      expect(result).toContain('Generated by: npx tsdevstack infra:generate');
    });
  });

  describe('snapshot', () => {
    it('should match snapshot', () => {
      const result = generateNetworkTf();
      expect(result).toMatchSnapshot();
    });
  });
});
