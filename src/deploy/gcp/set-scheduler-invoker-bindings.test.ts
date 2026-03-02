import { describe, it, expect, rs, beforeEach } from '@rstest/core';

const mockGetIamPolicy = rs.fn();
const mockSetIamPolicy = rs.fn();
const mockServicePath = rs.fn(
  (project: string, location: string, service: string) =>
    `projects/${project}/locations/${location}/services/${service}`,
);

rs.mock('@google-cloud/run', () => ({
  ServicesClient: rs.fn().mockImplementation(() => ({
    getIamPolicy: mockGetIamPolicy,
    setIamPolicy: mockSetIamPolicy,
    servicePath: mockServicePath,
  })),
}));

rs.mock('../../utils/gcp/build-gcp-client-options', () => ({
  buildGCPClientOptions: rs.fn(() => ({ projectId: 'my-project' })),
}));

import { setSchedulerInvokerBindings } from './set-scheduler-invoker-bindings';

const mockRuntime = {
  logger: {
    info: rs.fn(),
    success: rs.fn(),
    error: rs.fn(),
    warn: rs.fn(),
    debug: rs.fn(),
    newline: rs.fn(),
    generating: rs.fn(),
    running: rs.fn(),
    creating: rs.fn(),
    building: rs.fn(),
    checking: rs.fn(),
    complete: rs.fn(),
  },
  executeCommand: rs.fn(),
  writeFile: rs.fn(),
  readFile: rs.fn(),
  ensureDirectory: rs.fn(),
  cleanupFolder: rs.fn(),
  isCIEnv: rs.fn(),
};

const baseOptions = {
  projectId: 'my-project',
  projectName: 'my-app',
  region: 'us-central1',
  targetServices: ['auth-service'],
  credentials: {
    project_id: 'my-project',
    client_email: 'sa@my-project.iam.gserviceaccount.com',
    region: 'us-central1',
  },
};

const expectedMember =
  'serviceAccount:my-app-scheduler@my-project.iam.gserviceaccount.com';
const expectedResource =
  'projects/my-project/locations/us-central1/services/auth-service';

describe('setSchedulerInvokerBindings', () => {
  beforeEach(() => {
    rs.clearAllMocks();
    mockGetIamPolicy.mockResolvedValue([{ bindings: [] }]);
    mockSetIamPolicy.mockResolvedValue([{}]);
  });

  it('should get current IAM policy for target service', async () => {
    await setSchedulerInvokerBindings(mockRuntime, baseOptions);

    expect(mockGetIamPolicy).toHaveBeenCalledWith({
      resource: expectedResource,
    });
  });

  it('should add scheduler SA run.invoker binding', async () => {
    await setSchedulerInvokerBindings(mockRuntime, baseOptions);

    expect(mockSetIamPolicy).toHaveBeenCalledWith({
      resource: expectedResource,
      policy: expect.objectContaining({
        bindings: [{ role: 'roles/run.invoker', members: [expectedMember] }],
      }),
    });
  });

  it('should log success after setting binding', async () => {
    await setSchedulerInvokerBindings(mockRuntime, baseOptions);

    expect(mockRuntime.logger.success).toHaveBeenCalledWith(
      expect.stringContaining('scheduler can invoke auth-service'),
    );
  });

  it('should skip if binding already exists', async () => {
    mockGetIamPolicy.mockResolvedValue([
      {
        bindings: [{ role: 'roles/run.invoker', members: [expectedMember] }],
      },
    ]);

    await setSchedulerInvokerBindings(mockRuntime, baseOptions);

    expect(mockSetIamPolicy).not.toHaveBeenCalled();
    expect(mockRuntime.logger.success).toHaveBeenCalled();
  });

  it('should append to existing run.invoker binding with other members', async () => {
    mockGetIamPolicy.mockResolvedValue([
      {
        bindings: [{ role: 'roles/run.invoker', members: ['allUsers'] }],
      },
    ]);

    await setSchedulerInvokerBindings(mockRuntime, baseOptions);

    expect(mockSetIamPolicy).toHaveBeenCalledWith({
      resource: expectedResource,
      policy: expect.objectContaining({
        bindings: [
          {
            role: 'roles/run.invoker',
            members: ['allUsers', expectedMember],
          },
        ],
      }),
    });
  });

  it('should handle multiple target services', async () => {
    const multiOptions = {
      ...baseOptions,
      targetServices: ['auth-service', 'api-service'],
    };

    await setSchedulerInvokerBindings(mockRuntime, multiOptions);

    expect(mockGetIamPolicy).toHaveBeenCalledTimes(2);
    expect(mockSetIamPolicy).toHaveBeenCalledTimes(2);
    expect(mockServicePath).toHaveBeenCalledWith(
      'my-project',
      'us-central1',
      'auth-service',
    );
    expect(mockServicePath).toHaveBeenCalledWith(
      'my-project',
      'us-central1',
      'api-service',
    );
  });

  it('should warn on failure and continue to next service', async () => {
    const multiOptions = {
      ...baseOptions,
      targetServices: ['failing-service', 'auth-service'],
    };

    mockGetIamPolicy
      .mockRejectedValueOnce(new Error('API error'))
      .mockResolvedValueOnce([{ bindings: [] }]);

    await setSchedulerInvokerBindings(mockRuntime, multiOptions);

    expect(mockRuntime.logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('failing-service'),
    );
    // Second service still processed
    expect(mockSetIamPolicy).toHaveBeenCalledTimes(1);
  });

  it('should construct scheduler SA email from projectName and projectId', async () => {
    await setSchedulerInvokerBindings(mockRuntime, baseOptions);

    expect(mockSetIamPolicy).toHaveBeenCalledWith(
      expect.objectContaining({
        policy: expect.objectContaining({
          bindings: expect.arrayContaining([
            expect.objectContaining({
              members: [expectedMember],
            }),
          ]),
        }),
      }),
    );
  });

  it('should handle empty targetServices array', async () => {
    await setSchedulerInvokerBindings(mockRuntime, {
      ...baseOptions,
      targetServices: [],
    });

    expect(mockGetIamPolicy).not.toHaveBeenCalled();
    expect(mockSetIamPolicy).not.toHaveBeenCalled();
  });
});
