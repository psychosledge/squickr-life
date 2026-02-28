/**
 * Minimal logger for the domain package.
 *
 * The domain package has no runtime dependencies, so this is a thin wrapper
 * around the global `console` object.  It intentionally mirrors the interface
 * of the client-side logger (`packages/client/src/utils/logger.ts`) so that
 * call sites look identical.
 */

function warn(...args: unknown[]): void {
  console.warn(...args);
}

export const logger = {
  warn,
};
