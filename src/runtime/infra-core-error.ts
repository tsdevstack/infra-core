/**
 * InfraCoreError
 *
 * Error class for infra-core operations. Mirrors cli-core's CliError
 * pattern (message + context + hint) but has no dependency on cli-core.
 */

export class InfraCoreError extends Error {
  /**
   * @param message - The core error message
   * @param context - Where the error occurred (e.g., "Terraform generation")
   * @param hint - Optional hint about how to fix it
   * @param options - The error this one wraps (`cause`), for callers that
   *   act on its code
   */
  constructor(
    message: string,
    public context?: string,
    public hint?: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'InfraCoreError';
  }

  /**
   * Format the error for display with context and hint
   */
  format(): string {
    let output = this.context ? `${this.context}:\n\n` : '';
    output += this.message;
    if (this.hint) {
      output += `\n\n${this.hint}`;
    }
    return output;
  }
}
