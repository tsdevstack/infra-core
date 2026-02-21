/**
 * Runtime Interface Types
 *
 * Defines the interfaces that infra-core uses for logging, error handling,
 * shell execution, and file I/O. infra-core owns default implementations
 * of these interfaces. Consumers (cli-infra, simpler framework) can
 * override via options.
 */

/**
 * Logger interface for infra-core operations
 *
 * Matches the shape of cli-core's logger so adapters can pass it through.
 * infra-core provides a default console-based implementation.
 */
export interface InfraCoreLogger {
  info(message: string): void;
  success(message: string): void;
  error(message: string): void;
  warn(message: string): void;
  debug(message: string): void;
  newline(): void;
  generating(message: string): void;
  running(message: string): void;
  creating(message: string): void;
  building(message: string): void;
  checking(message: string): void;
  complete(message: string): void;
}

/**
 * Options for shell command execution
 */
export interface ExecuteCommandOptions {
  /** Working directory for command execution */
  cwd?: string;
  /** Whether to inherit stdio (show command output in real-time) */
  stdio?: 'inherit' | 'pipe' | 'ignore';
  /** Whether to log the command before execution (default: true) */
  logCommand?: boolean;
  /** Whether to exit on error (default: true) */
  exitOnError?: boolean;
  /** Environment variables to pass to the command */
  env?: Record<string, string | undefined>;
}

/**
 * Runtime services that infra-core depends on
 *
 * Adapters can provide custom implementations. infra-core provides
 * defaults for standalone usage.
 */
export interface InfraCoreRuntime {
  logger: InfraCoreLogger;
  executeCommand(
    command: string,
    options?: ExecuteCommandOptions,
  ): string | void;
  writeFile(path: string, content: string): void;
  readFile(path: string): string;
  ensureDirectory(path: string): void;
  cleanupFolder(path: string, exclude?: string[]): void;
  isCIEnv(): boolean;
}
