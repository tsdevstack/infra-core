/**
 * Azure App Service constants (Kong and Next.js plans)
 */

/**
 * CPU autoscale rule for App Service plans on Standard and Premium SKUs,
 * mirroring the 70% CPU target of the AWS services. The scale-in line is far
 * enough below the scale-out line that removing one instance from two (CPU
 * doubles on the one left) does not cross it again (Azure's flapping
 * guidance). Durations are ISO 8601, as the autoscale API wants them.
 */
export const AZURE_APP_SERVICE_AUTOSCALE = {
  metricName: 'CpuPercentage',
  timeGrain: 'PT1M',
  scaleOutCpuPercent: 70,
  scaleOutWindow: 'PT5M',
  scaleOutCooldown: 'PT5M',
  scaleInCpuPercent: 30,
  scaleInWindow: 'PT10M',
  scaleInCooldown: 'PT10M',
} as const;

/**
 * App Service health check for plans with more than one instance (or
 * autoscale): a failing instance leaves the load balancer after this many
 * failed pings, one per minute (2 to 10). App Service never removes the
 * last healthy instance. Kong answers /status from its health route; the
 * Next.js template serves /health.
 */
export const AZURE_APP_SERVICE_HEALTH_CHECK = {
  kongPath: '/status',
  nextjsPath: '/health',
  evictionTimeMin: 2,
} as const;

/**
 * How Kong finds the client's address on App Service. Kong's peer is App
 * Service's front end on a link-local address (169.254.x.x, which cannot come
 * from the internet), so with the image defaults (private ranges trusted,
 * X-Forwarded-For) Kong sees every client as that one address and its per-IP
 * rate limits become one bucket shared by everyone. Front Door sends the
 * address of the connection it accepted in X-Azure-SocketIP; X-Azure-ClientIP
 * can be set by the client, so it is not used. App settings become container
 * environment variables and override the image defaults.
 */
export const AZURE_KONG_CLIENT_IP_SETTINGS = {
  KONG_TRUSTED_IPS: '169.254.0.0/16',
  KONG_REAL_IP_HEADER: 'X-Azure-SocketIP',
  KONG_REAL_IP_RECURSIVE: 'off',
} as const;

/**
 * Next.js App Service: the incoming header with the visitor's address (Front
 * Door's X-Azure-SocketIP, as for Kong above). The frontend template's
 * forwardClientIp sends it to Kong with the frontend token, so Kong rate-limits
 * the server-side calls per visitor.
 */
export const AZURE_NEXTJS_CLIENT_IP_SETTINGS = {
  TSDEVSTACK_CLIENT_IP_HEADER:
    AZURE_KONG_CLIENT_IP_SETTINGS.KONG_REAL_IP_HEADER,
} as const;

/**
 * Kong's private endpoint, created when the project has Next.js apps: their
 * servers call Kong through it (KONG_INTERNAL_URL is Kong's default host
 * name, resolved to the endpoint in the VNet), so those calls skip Front
 * Door and its WAF, whose per-IP limit would count every visitor as the
 * Next.js app's outbound address. Resource name:
 * {project}-{env}{suffix}. The Front Door Premium lockdown ignores this
 * endpoint when it waits for Front Door's own Private Link connection.
 */
export const AZURE_KONG_PRIVATE_ENDPOINT = {
  nameSuffix: '-kong-pe',
  dnsZone: 'privatelink.azurewebsites.net',
  subresource: 'sites',
} as const;
