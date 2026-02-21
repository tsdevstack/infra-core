/**
 * Default logger for infra-core
 *
 * Console-based implementation of InfraCoreLogger.
 * Adapters can override this by passing their own logger.
 */

import type { InfraCoreLogger } from '../types/runtime.ts';

export const defaultLogger: InfraCoreLogger = {
  info: (message: string): void => {
    console.log(message);
  },
  success: (message: string): void => {
    console.log(`✅ ${message}`);
  },
  error: (message: string): void => {
    console.error(`❌ ${message}`);
  },
  warn: (message: string): void => {
    console.warn(`⚠️  ${message}`);
  },
  debug: (message: string): void => {
    console.error(`🐛 ${message}`);
  },
  newline: (): void => {
    console.log('');
  },
  generating: (message: string): void => {
    console.log(`⚙️  ${message}`);
  },
  running: (message: string): void => {
    console.log(`📦 ${message}`);
  },
  creating: (message: string): void => {
    console.log(`📝 ${message}`);
  },
  building: (message: string): void => {
    console.log(`🔨 ${message}`);
  },
  checking: (message: string): void => {
    console.log(`🔍 ${message}`);
  },
  complete: (message: string): void => {
    console.log(`🎉 ${message}`);
  },
};
