import { describe, it, expect, rs, afterEach } from '@rstest/core';
import { generateJobInvokerLambdaCode } from './generate-job-invoker-lambda-code';

type Handler = (event: Record<string, unknown>) => Promise<unknown>;

/**
 * Load the generated handler with a fake Secrets Manager and return it.
 * The code is plain CommonJS, so it runs as is.
 */
function loadHandler(): Handler {
  const exportsObject: { handler?: Handler } = {};
  const fakeRequire = (): Record<string, unknown> => ({
    SecretsManagerClient: function () {
      return { send: async () => ({ SecretString: 'job-secret' }) };
    },
    GetSecretValueCommand: function () {},
  });
  new Function('require', 'exports', 'process', generateJobInvokerLambdaCode())(
    fakeRequire,
    exportsObject,
    { env: { CLOUDMAP_NAMESPACE: 'myapp.local', JOB_SECRET_ARN: 'arn' } },
  );
  if (!exportsObject.handler) throw new Error('no handler exported');
  return exportsObject.handler;
}

describe('generateJobInvokerLambdaCode', () => {
  describe('imports', () => {
    it('should not import the ECS client (no wake-up step)', () => {
      const result = generateJobInvokerLambdaCode();
      expect(result).not.toContain('@aws-sdk/client-ecs');
      expect(result).not.toContain('ECSClient');
      expect(result).not.toContain('UpdateServiceCommand');
      expect(result).not.toContain('DescribeServicesCommand');
    });

    it('should import Secrets Manager client', () => {
      const result = generateJobInvokerLambdaCode();
      expect(result).toContain('SecretsManagerClient');
      expect(result).toContain('GetSecretValueCommand');
    });
  });

  describe('environment variables', () => {
    it('should not read ECS_CLUSTER or SERVICE_NAMES', () => {
      const result = generateJobInvokerLambdaCode();
      expect(result).not.toContain('ECS_CLUSTER');
      expect(result).not.toContain('SERVICE_NAMES');
    });

    it('should read CLOUDMAP_NAMESPACE from environment', () => {
      const result = generateJobInvokerLambdaCode();
      expect(result).toContain(
        'const NAMESPACE = process.env.CLOUDMAP_NAMESPACE;',
      );
    });

    it('should read JOB_SECRET_ARN from environment', () => {
      const result = generateJobInvokerLambdaCode();
      expect(result).toContain(
        'const JOB_SECRET_ARN = process.env.JOB_SECRET_ARN;',
      );
    });
  });

  describe('handler', () => {
    it('should read the job, its method and its wait from the event', () => {
      const result = generateJobInvokerLambdaCode();
      expect(result).toContain("method = 'POST',");
      expect(result).toContain('timeoutSeconds = 300,');
    });

    it('should start every line with the job name', () => {
      const result = generateJobInvokerLambdaCode();
      expect(result).toContain('console.log(`job=${job} ${message}`)');
      expect(result).toContain('console.error(`job=${job} ${message}`)');
      expect(result).toContain('log(`Run started: ${method} ${url}`);');
      expect(result).toContain(
        'log(`Run finished: ${response.status} in ${Date.now() - started}ms`);',
      );
    });

    it('should log the response body only when the job fails', () => {
      const result = generateJobInvokerLambdaCode();
      expect(result).toContain(
        '`Run finished: ${response.status} (${responseText.substring(0, 1000)})`',
      );
      expect(result).not.toContain('Response body:');
      expect(result).not.toContain('Job invocation received');
    });

    it('should validate required parameters', () => {
      const result = generateJobInvokerLambdaCode();
      expect(result).toContain('if (!serviceName || !path)');
      expect(result).toContain('Missing serviceName or path');
    });
  });

  describe('no service wake-up (AWS has no scale-to-zero)', () => {
    it('should not wake or scale services before invoking', () => {
      const result = generateJobInvokerLambdaCode();
      expect(result).not.toContain('ensureServicesRunning');
      expect(result).not.toContain('desiredCount');
      expect(result).not.toContain('maxWait');
    });
  });

  describe('job invocation', () => {
    it('should build URL using CloudMap DNS', () => {
      const result = generateJobInvokerLambdaCode();
      expect(result).toContain(
        '`http://${serviceName}.${NAMESPACE}:8080${path}`',
      );
    });

    it('should include X-Job-Secret header', () => {
      const result = generateJobInvokerLambdaCode();
      expect(result).toContain("'X-Job-Secret': SecretString");
    });
  });

  describe('running the handler', () => {
    const fetchMock = rs.fn();

    afterEach(() => {
      rs.restoreAllMocks();
      rs.unstubAllGlobals();
      fetchMock.mockReset();
    });

    function stubFetch(): void {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => 'done',
      });
      rs.stubGlobal('fetch', fetchMock);
      rs.spyOn(console, 'log').mockImplementation(() => undefined);
    }

    it("should call with the job's method and wait its httpTimeout", async () => {
      stubFetch();
      const timeoutSpy = rs.spyOn(AbortSignal, 'timeout');

      await loadHandler()({
        serviceName: 'reports-service',
        path: '/jobs/generate',
        jobName: 'reports-service-generate',
        method: 'GET',
        timeoutSeconds: 600,
      });

      expect(fetchMock).toHaveBeenCalledWith(
        'http://reports-service.myapp.local:8080/jobs/generate',
        expect.objectContaining({ method: 'GET' }),
      );
      expect(timeoutSpy).toHaveBeenCalledWith(600_000);
    });

    it('should send POST and wait 300 s for an event from an older schedule', async () => {
      stubFetch();
      const timeoutSpy = rs.spyOn(AbortSignal, 'timeout');

      await loadHandler()({
        serviceName: 'auth-service',
        path: '/jobs/cleanup',
        jobName: 'auth-service-cleanup',
      });

      expect(fetchMock).toHaveBeenCalledWith(
        'http://auth-service.myapp.local:8080/jobs/cleanup',
        expect.objectContaining({ method: 'POST' }),
      );
      expect(timeoutSpy).toHaveBeenCalledWith(300_000);
    });
  });

  describe('secrets management', () => {
    it('should retrieve job auth secret', () => {
      const result = generateJobInvokerLambdaCode();
      expect(result).toContain(
        'GetSecretValueCommand({ SecretId: JOB_SECRET_ARN })',
      );
    });

    it('should throw error if secret not found', () => {
      const result = generateJobInvokerLambdaCode();
      expect(result).toContain('Failed to retrieve job auth secret');
    });
  });

  describe('error handling', () => {
    it('should check response ok status', () => {
      const result = generateJobInvokerLambdaCode();
      expect(result).toContain('if (!response.ok)');
    });

    it('should rethrow errors for retry', () => {
      const result = generateJobInvokerLambdaCode();
      expect(result).toContain(
        'throw error; // Rethrow to trigger retry policy',
      );
    });
  });

  describe('header comment', () => {
    it('should include generation comment', () => {
      const result = generateJobInvokerLambdaCode();
      expect(result).toContain('Generated by: npx tsdevstack infra:generate');
    });
  });

  describe('snapshot', () => {
    it('should match snapshot', () => {
      const result = generateJobInvokerLambdaCode();
      expect(result).toMatchSnapshot();
    });
  });
});
