/**
 * Client address on AWS (Kong and Next.js on ECS behind CloudFront and the ALB)
 */

import { EDGE_CLIENT_IP_HEADER } from './edge-client-ip.ts';

/**
 * How Kong finds the client's address on ECS: from the header a CloudFront
 * function sets on every viewer request (EDGE_CLIENT_IP_HEADER, the viewer's
 * address from `event.viewer.ip`), trusted from any peer. That is safe because
 * Kong's security group admits only the ALB, which forwards nothing without
 * CloudFront's X-Origin-Verify secret, and the project's own ECS tasks (the
 * Next.js servers, which do not send the header). X-Forwarded-For is not
 * used: CloudFront appends the viewer and the ALB appends CloudFront's edge,
 * so Kong would count every visitor behind one edge as one client. Set as
 * the Kong task's environment; it overrides the image defaults.
 */
export const AWS_KONG_CLIENT_IP_SETTINGS = {
  KONG_TRUSTED_IPS: '0.0.0.0/0,::/0',
  KONG_REAL_IP_HEADER: EDGE_CLIENT_IP_HEADER,
  KONG_REAL_IP_RECURSIVE: 'off',
} as const;

/**
 * Next.js on ECS: the incoming header with the visitor's address (the same
 * CloudFront function header). The frontend template's forwardClientIp sends
 * it to Kong with the frontend token, so the server-side calls count per
 * visitor.
 */
export const AWS_NEXTJS_CLIENT_IP_SETTINGS = {
  TSDEVSTACK_CLIENT_IP_HEADER: EDGE_CLIENT_IP_HEADER,
} as const;

/**
 * Kong's name in the Cloud Map namespace: the Next.js servers call Kong at
 * http://kong.{project}.local:8080 inside the VPC (KONG_INTERNAL_URL), off
 * CloudFront and its WAF, whose per-IP rule would count every visitor as the
 * tasks' NAT address.
 */
export const AWS_KONG_CLOUD_MAP_NAME = 'kong';
