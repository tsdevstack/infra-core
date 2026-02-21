import { describe, it, expect } from '@rstest/core';
import { generateAlbTf } from './generate-alb-tf';

describe('generateAlbTf', () => {
  describe('load balancer', () => {
    it('should create application load balancer', () => {
      const result = generateAlbTf();
      expect(result).toContain('resource "aws_lb" "main"');
    });

    it('should be public-facing (not internal)', () => {
      const result = generateAlbTf();
      expect(result).toContain('internal           = false');
    });

    it('should use application load balancer type', () => {
      const result = generateAlbTf();
      expect(result).toContain('load_balancer_type = "application"');
    });

    it('should use public subnets', () => {
      const result = generateAlbTf();
      expect(result).toContain('subnets            = aws_subnet.public[*].id');
    });

    it('should enable deletion protection', () => {
      const result = generateAlbTf();
      expect(result).toContain('enable_deletion_protection = true');
    });

    it('should use ALB security group', () => {
      const result = generateAlbTf();
      expect(result).toContain(
        'security_groups    = [aws_security_group.alb.id]',
      );
    });
  });

  describe('origin verification', () => {
    it('should create random password for origin verification', () => {
      const result = generateAlbTf();
      expect(result).toContain(
        'resource "random_password" "origin_verify_secret"',
      );
    });

    it('should create origin verification listener rule', () => {
      const result = generateAlbTf();
      expect(result).toContain(
        'resource "aws_lb_listener_rule" "origin_verify"',
      );
    });

    it('should validate X-Origin-Verify header', () => {
      const result = generateAlbTf();
      expect(result).toContain('http_header_name = "X-Origin-Verify"');
      expect(result).toContain('random_password.origin_verify_secret.result');
    });
  });

  describe('target groups', () => {
    it('should create target groups using for_each', () => {
      const result = generateAlbTf();
      expect(result).toContain('resource "aws_lb_target_group" "service"');
      expect(result).toContain('for_each = var.services');
    });

    it('should use port 8080 for target groups', () => {
      const result = generateAlbTf();
      expect(result).toContain('port        = 8080');
    });

    it('should use IP target type for Fargate', () => {
      const result = generateAlbTf();
      expect(result).toContain('target_type = "ip"');
    });

    it('should configure health check on /health', () => {
      const result = generateAlbTf();
      expect(result).toContain('path                = "/health"');
    });

    it('should use 120s deregistration delay for zero-downtime deployments', () => {
      const result = generateAlbTf();
      expect(result).toContain('deregistration_delay = 120');
    });
  });

  describe('HTTPS listener (external)', () => {
    it('should create HTTPS listener on port 443', () => {
      const result = generateAlbTf();
      expect(result).toContain('resource "aws_lb_listener" "https"');
      expect(result).toContain('port              = 443');
      expect(result).toContain('protocol          = "HTTPS"');
    });

    it('should use TLS 1.3 security policy', () => {
      const result = generateAlbTf();
      expect(result).toContain(
        'ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"',
      );
    });

    it('should return 403 by default (no valid origin header)', () => {
      const result = generateAlbTf();
      expect(result).toContain('status_code  = "403"');
      expect(result).toContain('Forbidden');
    });

    it('should forward to Kong when origin header is valid', () => {
      const result = generateAlbTf();
      expect(result).toContain(
        'target_group_arn = aws_lb_target_group.service["kong"].arn',
      );
    });
  });

  describe('internal HTTPS listener', () => {
    it('should create internal HTTPS listener on port 8443', () => {
      const result = generateAlbTf();
      // Resource is named "internal" (not "internal_https") for Kong upstream routing
      expect(result).toContain('resource "aws_lb_listener" "internal"');
      expect(result).toContain('port              = 8443');
    });
  });

  describe('internal HTTP listener', () => {
    it('should create internal HTTP listener on port 8080', () => {
      const result = generateAlbTf();
      expect(result).toContain('resource "aws_lb_listener" "internal_http"');
      expect(result).toContain('port              = 8080');
    });
  });

  describe('HTTP redirect listener', () => {
    it('should redirect HTTP to HTTPS', () => {
      const result = generateAlbTf();
      expect(result).toContain('port              = 80');
      expect(result).toContain('type = "redirect"');
      expect(result).toContain('status_code = "HTTP_301"');
    });
  });

  describe('host-based routing', () => {
    it('should create listener rules for internal routing', () => {
      const result = generateAlbTf();
      expect(result).toContain('resource "aws_lb_listener_rule"');
    });

    it('should route based on Host header', () => {
      const result = generateAlbTf();
      expect(result).toContain('host_header');
    });
  });

  describe('header comment', () => {
    it('should include generation comment', () => {
      const result = generateAlbTf();
      expect(result).toContain('Generated by: npx tsdevstack infra:generate');
    });
  });

  describe('snapshot', () => {
    it('should match snapshot', () => {
      const result = generateAlbTf();
      expect(result).toMatchSnapshot();
    });
  });
});
