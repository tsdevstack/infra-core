/**
 * Terraform provider versions the generated config pins
 */

/**
 * A new major version needs an explicit step on existing environments: their
 * committed .terraform.lock.hcl keeps the old version until
 * `infra:plan --upgrade` runs `terraform init -upgrade`.
 */
export const TERRAFORM_PROVIDER_VERSIONS = {
  aws: '~> 6.71',
  google: '~> 8.9',
  azurerm: '~> 5.12',
  // Azure resources azurerm can't create yet (the traces data collection rule)
  azapi: '~> 2.13',
  random: '~> 3.0',
} as const;

/**
 * Shown when `terraform init` fails because the lock file holds an older
 * provider version than the pin allows
 */
export const PROVIDER_LOCK_MISMATCH_HINT =
  "This CLI version uses newer Terraform providers than the ones in this environment's .terraform.lock.hcl. " +
  'Upgrade them on purpose: run npx tsdevstack infra:plan --env <environment> --upgrade, review the plan, then commit the updated lock file.';
