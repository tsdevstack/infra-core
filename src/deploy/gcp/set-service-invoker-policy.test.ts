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

import { setServiceInvokerPolicy } from './set-service-invoker-policy';

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
  region: 'us-central1',
  serviceName: 'my-service',
  credentials: {
    project_id: 'my-project',
    client_email: 'sa@my-project.iam.gserviceaccount.com',
    region: 'us-central1',
  },
};

describe('setServiceInvokerPolicy', () => {
  beforeEach(() => {
    rs.clearAllMocks();
    mockGetIamPolicy.mockResolvedValue([{ bindings: [] }]);
    mockSetIamPolicy.mockResolvedValue([{}]);
  });

  it('should get current IAM policy', async () => {
    await setServiceInvokerPolicy(mockRuntime, baseOptions);

    expect(mockGetIamPolicy).toHaveBeenCalledWith({
      resource: 'projects/my-project/locations/us-central1/services/my-service',
    });
  });

  it('should add allUsers run.invoker binding', async () => {
    await setServiceInvokerPolicy(mockRuntime, baseOptions);

    expect(mockSetIamPolicy).toHaveBeenCalledWith({
      resource: 'projects/my-project/locations/us-central1/services/my-service',
      policy: expect.objectContaining({
        bindings: [{ role: 'roles/run.invoker', members: ['allUsers'] }],
      }),
    });
  });

  it('should log success', async () => {
    await setServiceInvokerPolicy(mockRuntime, baseOptions);

    expect(mockRuntime.logger.success).toHaveBeenCalledWith(
      expect.stringContaining('IAM: allUsers can invoke'),
    );
  });

  it('should skip if binding already exists', async () => {
    mockGetIamPolicy.mockResolvedValue([
      {
        bindings: [{ role: 'roles/run.invoker', members: ['allUsers'] }],
      },
    ]);

    await setServiceInvokerPolicy(mockRuntime, baseOptions);

    expect(mockSetIamPolicy).not.toHaveBeenCalled();
    expect(mockRuntime.logger.success).toHaveBeenCalled();
  });

  it('should warn on failure', async () => {
    mockGetIamPolicy.mockRejectedValue(new Error('API error'));

    await setServiceInvokerPolicy(mockRuntime, baseOptions);

    expect(mockRuntime.logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Could not set IAM invoker policy'),
    );
  });
});
