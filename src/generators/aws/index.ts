/**
 * AWS Terraform file generators
 */

export { generateMainTf } from './generate-main-tf.ts';
export { generateKmsTf } from './generate-kms-tf.ts';
export { generateCloudtrailTf } from './generate-cloudtrail-tf.ts';
export { generateVariablesTf } from './generate-variables-tf.ts';
export { generateTfvars } from './generate-tfvars.ts';
export {
  generateOutputsTf,
  type OutputsConfig,
} from './generate-outputs-tf.ts';
export { generateNetworkTf } from './generate-network-tf.ts';
export { generateVpcFlowLogsTf } from './generate-vpc-flow-logs-tf.ts';
export { generateIamTf } from './generate-iam-tf.ts';
export { generateEcrTf } from './generate-ecr-tf.ts';
export { generateDatabaseTf } from './generate-database-tf.ts';
export { generateRedisTf } from './generate-redis-tf.ts';
export { generateEcsTf } from './generate-ecs-tf.ts';
export { generateAlbTf } from './generate-alb-tf.ts';
export { generateWafTf, type WafTfConfig } from './generate-waf-tf.ts';
export { generateAwsCustomWafRules } from './generate-custom-waf-rules.ts';
export {
  generateResponseHeadersPolicyTf,
  type ResponseHeadersPolicyConfig,
} from './generate-response-headers-policy-tf.ts';
export { generateCloudfrontTf } from './generate-cloudfront-tf.ts';
export { generateWakeupLambdaTf } from './generate-wakeup-lambda-tf.ts';
export { generateAcmTf } from './generate-acm-tf.ts';
export { generateRoute53Tf } from './generate-route53-tf.ts';
export { generateS3SpaTf } from './generate-s3-spa-tf.ts';
export { generateEventbridgeTf } from './generate-eventbridge-tf.ts';
export { generateScaleDownTf } from './generate-scale-down-tf.ts';
export { generateAppRunnerTf } from './generate-apprunner-tf.ts';
export { generateNextjsCloudfrontTf } from './generate-nextjs-cloudfront-tf.ts';
export { generateRedirectTf } from './generate-redirect-tf.ts';
export { generateWakeupLambdaCode } from './generate-wakeup-lambda-code.ts';
export { generateJobInvokerLambdaCode } from './generate-job-invoker-lambda-code.ts';
export { generateDbInitTf } from './generate-db-init-tf.ts';
export { generateDbInit, type DbInitFiles } from './generate-db-init.ts';
export { generateDbDeleteTf } from './generate-db-delete-tf.ts';
export { generateDbDelete, type DbDeleteFiles } from './generate-db-delete.ts';
