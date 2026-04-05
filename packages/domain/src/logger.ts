/**
 * Minimal logger for the domain package.
 *
 * The domain package has no runtime dependencies, so this is a thin wrapper
 * around the global `console` object.  It intentionally mirrors the interface
 * of the client-side logger (`packages/client/src/utils/logger.ts`) so that
 * call sites look identical.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

interface LoggerConfig {
  level: LogLevel;
  enabled: boolean;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  silent: 4,
};

const config: LoggerConfig = {
  level: 'warn',
  enabled: true,
};

function shouldLog(level: LogLevel): boolean {
  if (!config.enabled) return false;
  return LOG_LEVELS[level] >= LOG_LEVELS[config.level];
}

function debug(...args: unknown[]): void {
  if (shouldLog('debug')) {
    console.log(...args);
  }
}

function info(...args: unknown[]): void {
  if (shouldLog('info')) {
    console.log(...args);
  }
}

function warn(...args: unknown[]): void {
  if (shouldLog('warn')) {
    console.warn(...args);
  }
}

function error(...args: unknown[]): void {
  if (shouldLog('error')) {
    console.error(...args);
  }
}

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
