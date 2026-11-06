/**
 * Azure Container Apps scaling
 */

/**
 * Scale rule of a Container App without ingress (a worker): KEDA's CPU
 * scaler adds replicas above 70% average CPU, between minReplicas and
 * maxReplicas, the same target as ECS workers on AWS. Without a rule a
 * Container App stays at minReplicas (and Azure warns "no triggers
 * defined").
 */
export const AZURE_WORKER_CPU_SCALE_RULE = {
  name: 'cpu-scaling',
  custom: {
    type: 'cpu',
    metadata: { type: 'Utilization', value: '70' },
  },
};
