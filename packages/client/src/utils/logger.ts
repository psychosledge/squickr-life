/**
 * Logger Utility
 * 
 * Centralized logging with configurable levels and prefixes.
 * Provides consistent formatting across the application.
 * 
 * Usage:
 *   import { logger } from '../utils/logger';
 *   logger.info('[Component]', 'Message');
 *   logger.warn('[Component]', 'Warning');
 *   logger.error('[Component]', 'Error', errorObject);
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

interface LoggerConfig {
  level: LogLevel;
  enabled: boolean;
}

const config: LoggerConfig = {
  level: import.meta.env.DEV ? 'debug' : 'warn',
  enabled: true,
};

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  silent: 4,
};

function shouldLog(level: LogLevel): boolean {
  if (!config.enabled) return false;
  return LOG_LEVELS[level] >= LOG_LEVELS[config.level];
}

/**
 * Log debug messages (development only)
 */
function debug(prefix: string, ...args: unknown[]): void {
  if (shouldLog('debug')) {
    console.log(`${prefix}`, ...args);
  }
}

/**
 * Log informational messages
 */
function info(prefix: string, ...args: unknown[]): void {
  if (shouldLog('info')) {
    console.log(`${prefix}`, ...args);
  }
}

/**
 * Log warning messages
 */
function warn(prefix: string, ...args: unknown[]): void {
  if (shouldLog('warn')) {
    console.warn(`${prefix}`, ...args);
  }
}

/**
 * Log error messages
 */
function error(prefix: string, ...args: unknown[]): void {
  if (shouldLog('error')) {
    console.error(`${prefix}`, ...args);
  }
}

/**
 * Configure logger settings
 */
function configure(options: Partial<LoggerConfig>): void {
  Object.assign(config, options);
}

export const logger = {
  debug,
  info,
  warn,
  error,
  configure,
};
