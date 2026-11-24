import { describe, it, expect } from '@rstest/core';
import { generateCronJobsTf } from './generate-cron-jobs-tf';

describe('generateCronJobsTf', () => {
  const tf = generateCronJobsTf();

  it('should match the snapshot', () => {
    expect(tf).toMatchSnapshot();
  });

  describe('task definition', () => {
    it("should run the service's image as node dist/cron.js <name> under dumb-init", () => {
      expect(tf).toContain('resource "aws_ecs_task_definition" "cron_job"');
      expect(tf).toContain(
        'family                   = "${var.project_name}-cron-${each.key}"',
      );
      expect(tf).toContain(
        'command = ["dumb-init", "node", "dist/cron.js", each.key]',
      );
      expect(tf).toContain(
        'image = "${aws_ecr_repository.service[each.value.service].repository_url}:latest"',
      );
    });

    it("should run with the service's task role and the shared execution role", () => {
      expect(tf).toContain(
        'task_role_arn            = aws_iam_role.task[each.value.service].arn',
      );
      expect(tf).toContain(
        'execution_role_arn       = aws_iam_role.ecs_execution.arn',
      );
    });

    it("should give the container the job's name and timeout", () => {
      expect(tf).toContain('{ name = "CRON_JOB_NAME", value = each.key }');
      expect(tf).toContain(
        '{ name = "CRON_JOB_TIMEOUT", value = tostring(each.value.timeout) }',
      );
      expect(tf).toContain(
        '{ name = "SERVICE_NAME", value = each.value.service }',
      );
    });

    it('should log to its own group, which a targeted apply creates with it', () => {
      expect(tf).toContain(
        'name              = "/ecs/${var.project_name}/cron-${each.key}"',
      );
      expect(tf).toContain(
        '"awslogs-group"         = aws_cloudwatch_log_group.cron_job[each.key].name',
      );
    });

    it('should tag the definition and the log group with the service and the job', () => {
      expect(tf).toContain('"tsdevstack-cron-service" = each.value.service');
      expect(tf).toContain('"tsdevstack-cron-job"     = each.key');
    });
  });

  describe('schedule', () => {
    it('should start the task on the cluster as the cron scheduler role, in the private subnets', () => {
      expect(tf).toContain('resource "aws_scheduler_schedule" "cron_job"');
      expect(tf).toContain('arn      = aws_ecs_cluster.main.arn');
      expect(tf).toContain('role_arn = aws_iam_role.cron_scheduler[0].arn');
      expect(tf).toContain(
        'task_definition_arn = aws_ecs_task_definition.cron_job[each.key].arn',
      );
      expect(tf).toContain('launch_type         = "FARGATE"');
      expect(tf).toContain('subnets          = aws_subnet.private[*].id');
      expect(tf).toContain('assign_public_ip = false');
    });

    it("should be named as a trigger's schedule", () => {
      expect(tf).toContain(
        'name       = "${var.project_name}-${each.value.service}-${each.key}"',
      );
    });

    it('should never retry a start', () => {
      expect(tf).toContain('maximum_retry_attempts       = 0');
      expect(tf).not.toContain('dead_letter_config');
    });

    it('should leave the revision the deploys set alone', () => {
      expect(tf).toContain(
        'ignore_changes = [target[0].ecs_parameters[0].task_definition_arn]',
      );
    });

    it("should come with its role's policy", () => {
      expect(tf).toContain('depends_on = [aws_iam_role_policy.cron_scheduler]');
    });
  });

  describe('scheduler role', () => {
    it('should exist only while there is a cron job', () => {
      expect(
        tf.match(/count = length\(var\.cron_jobs\) > 0 \? 1 : 0/g),
      ).toHaveLength(2);
    });

    it("should run only the cron jobs' task definitions, in this cluster", () => {
      expect(tf).toContain('Action    = "ecs:RunTask"');
      expect(tf).toContain(
        'task-definition/${var.project_name}-cron-${name}:*',
      );
      expect(tf).toContain(
        'Condition = { ArnEquals = { "ecs:cluster" = aws_ecs_cluster.main.arn } }',
      );
    });

    it("should pass only the execution role and the services' task roles, to ECS tasks", () => {
      expect(tf).toContain('Action    = "iam:PassRole"');
      expect(tf).toContain('aws_iam_role.task[job.service].arn');
      expect(tf).toContain('"iam:PassedToService" = "ecs-tasks.amazonaws.com"');
    });

    it('should be assumed by EventBridge Scheduler of this account only', () => {
      expect(tf).toContain(
        'Principal = { Service = "scheduler.amazonaws.com" }',
      );
      expect(tf).toContain('"aws:SourceAccount" = var.aws_account_id');
    });
  });
});
