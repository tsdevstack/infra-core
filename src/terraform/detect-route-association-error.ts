/**
 * Detect Azure Front Door route association errors in terraform output
 */

/**
 * Checks if terraform output contains errors about custom domains
 * still being associated with routes.
 *
 * This happens when a custom domain's host_name changes (ForceNew),
 * and Terraform tries to delete the old domain, but Azure refuses
 * deletion while a route still references it.
 *
 * @param output - The terraform output/error text
 * @returns true if the error is detected
 */
export function detectRouteAssociationError(output: string): boolean {
  return output.includes('associated with a route');
}
