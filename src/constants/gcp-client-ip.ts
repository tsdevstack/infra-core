/**
 * Client address on GCP (Kong and Next.js behind the load balancer)
 */

import { EDGE_CLIENT_IP_HEADER } from './edge-client-ip.ts';

/**
 * Request header the load balancer sets on its Cloud Run backends (Kong and
 * the Next.js apps) to the client's address, `{client_ip_address}`. Google:
 * headers added by the load balancer overwrite a header of the same name in
 * the client request, so a client cannot choose the value. X-Forwarded-For is
 * not used: the load balancer appends to what the client sent, and Cloud Run
 * does not document the address Kong sees as its peer.
 */
export const GCP_EDGE_CLIENT_IP_HEADER = EDGE_CLIENT_IP_HEADER;

/**
 * How Kong finds the client's address on Cloud Run: from the load balancer's
 * header, trusted from any peer. That is safe because Kong's ingress accepts
 * only the load balancer (which overwrites the header) and internal sources:
 * the project's VPC (the Next.js servers, which do not send it) and Google
 * services of the same project such as Cloud Scheduler or Pub/Sub; no client
 * controls those. A request without the header keeps its peer address. Set
 * as Kong's container environment; it overrides the image defaults.
 */
export const GCP_KONG_CLIENT_IP_SETTINGS = {
  KONG_TRUSTED_IPS: '0.0.0.0/0,::/0',
  KONG_REAL_IP_HEADER: GCP_EDGE_CLIENT_IP_HEADER,
  KONG_REAL_IP_RECURSIVE: 'off',
} as const;

/**
 * Next.js on Cloud Run: the incoming header with the visitor's address (the
 * same load balancer header). The frontend template's forwardClientIp sends
 * it to Kong with the frontend token, so the server-side calls count per
 * visitor.
 */
export const GCP_NEXTJS_CLIENT_IP_SETTINGS = {
  TSDEVSTACK_CLIENT_IP_HEADER: GCP_EDGE_CLIENT_IP_HEADER,
} as const;
