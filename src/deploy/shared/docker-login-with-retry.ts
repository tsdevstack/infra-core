/**
 * Execute a docker login with retry for transient failures
 *
 * On fresh cloud project deployments, container registry APIs may not be
 * fully propagated yet. Retrying handles this transient window.
 */

export async function dockerLoginWithRetry(
  loginFn: () => void,
  options?: { maxRetries?: number; delayMs?: number },
): Promise<void> {
  const maxRetries = options?.maxRetries ?? 3;
  const delayMs = options?.delayMs ?? 5000;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      loginFn();
      return;
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  throw lastError;
}
