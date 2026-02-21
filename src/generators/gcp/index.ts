/**
 * GCP Terraform file generators
 */

export { generateMainTf } from './generate-main-tf.ts';
export { generateVariablesTf } from './generate-variables-tf.ts';
export { generateNetworkTf } from './generate-network-tf.ts';
export { generateDatabaseTf } from './generate-database-tf.ts';
export { generateRedisTf } from './generate-redis-tf.ts';
export { generateIamTf } from './generate-iam-tf.ts';
export type { ServiceIamInfo } from './generate-iam-tf.ts';
export { generateArtifactRegistryTf } from './generate-artifact-registry-tf.ts';
export {
  generateOutputsTf,
  type OutputsConfig,
} from './generate-outputs-tf.ts';
export { generateTfvars } from './generate-tfvars.ts';
export {
  generateSpaBucketsTf,
  type SpaServiceConfig,
} from './generate-spa-buckets-tf.ts';
export {
  generateLoadBalancerTf,
  type LoadBalancerConfig,
  type FrontendServiceConfig,
} from './generate-loadbalancer-tf.ts';
export { generateCloudSchedulerTf } from './generate-cloud-scheduler-tf.ts';
export { generateCustomWafRules } from './generate-custom-waf-rules.ts';
export { generateSpaEdgeSecurityPolicy } from './generate-spa-edge-security-policy.ts';
