import { describe, it, expect, rs, beforeEach } from '@rstest/core';

const { mockGetEntries } = rs.hoisted(() => ({
  mockGetEntries: rs.fn(),
}));

rs.mock('@google-cloud/logging', () => ({
  Logging: class {
    getEntries = mockGetEntries;
  },
}));
rs.mock('../../utils/async/sleep.ts', () => ({
  sleep: rs.fn(async () => {}),
}));

import { fetchJobLogs } from './fetch-cloud-run-logs';

const target = {
  projectId: 'gcp-shop',
  region: 'europe-west1',
  jobName: 'shop-cron-usage-report',
  credentials: {
    project_id: 'gcp-shop',
    region: 'europe-west1',
    client_email: 'x@gcp-shop.iam.gserviceaccount.com',
    private_key: 'k',
  },
};

const execution =
  'projects/gcp-shop/locations/europe-west1/jobs/shop-cron-usage-report/executions/e1';

function entry(timestamp: string, msg: string): unknown {
  return { metadata: { timestamp, severity: 'INFO' }, data: { msg } };
}

describe('fetchJobLogs', () => {
  beforeEach(() => {
    rs.clearAllMocks();
  });

  describe('Standard use cases', () => {
    it("should read the execution's lines without audit entries, newest first", async () => {
      mockGetEntries.mockResolvedValue([[entry('t2', 'b'), entry('t1', 'a')]]);

      await fetchJobLogs(target, execution);

      const [query] = mockGetEntries.mock.calls[0] as [
        { filter: string; orderBy: string },
      ];
      expect(query.filter).toContain(
        'resource.labels.job_name="shop-cron-usage-report"',
      );
      expect(query.filter).toContain(
        'labels."run.googleapis.com/execution_name"="e1"',
      );
      expect(query.filter).toContain('NOT logName:"cloudaudit.googleapis.com"');
      expect(query.orderBy).toBe('timestamp desc');
    });

    it('should show the lines oldest first', async () => {
      mockGetEntries.mockResolvedValue([[entry('t2', 'b'), entry('t1', 'a')]]);

      expect(await fetchJobLogs(target, execution)).toBe(
        '[t1] INFO: a\n[t2] INFO: b',
      );
    });
  });

  describe('Edge cases', () => {
    it("should fall back to the job's lines, also without audit entries", async () => {
      mockGetEntries
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([[entry('t2', 'b'), entry('t1', 'a')]]);

      expect(await fetchJobLogs(target, execution)).toBe(
        '[t1] INFO: a\n[t2] INFO: b',
      );
      const [query] = mockGetEntries.mock.calls[1] as [{ filter: string }];
      expect(query.filter).toContain('NOT logName:"cloudaudit.googleapis.com"');
      expect(query.filter).not.toContain('execution_name');
    });

    it('should point at the console when there are no lines', async () => {
      mockGetEntries.mockResolvedValue([[]]);

      expect(await fetchJobLogs(target, execution)).toContain(
        'No logs found for job shop-cron-usage-report',
      );
    });

    it('should say why when the read fails', async () => {
      mockGetEntries.mockRejectedValue(new Error('denied'));

      expect(await fetchJobLogs(target, execution)).toBe(
        'Failed to fetch logs: denied',
      );
    });
  });
});
