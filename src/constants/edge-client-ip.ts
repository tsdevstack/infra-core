/**
 * Client address header set by a provider's edge
 */

/**
 * Request header the edge sets to the client's address on the providers
 * where the platform gives Kong no usable address of its own: GCP (the load
 * balancer's custom request header) and AWS (a CloudFront function). The edge
 * overwrites a client-sent value, so a client cannot choose it. Kong reads it
 * as its real IP header; the Next.js frontend reads it for the visitor it
 * names to Kong. Azure uses Front Door's own X-Azure-SocketIP instead.
 */
export const EDGE_CLIENT_IP_HEADER = 'X-Tsdevstack-Edge-IP';
