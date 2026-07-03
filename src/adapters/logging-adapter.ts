/**
 * @fileoverview Optional structured logging hooks for SDK integrators.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface AureonLogger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
}

export const silentLogger: AureonLogger = {
  debug() {},
  info() {},
  warn() {},
  error() {},
};

export function createConsoleLogger(prefix = "aureon-sdk"): AureonLogger {
  const write = (level: LogLevel, message: string, context?: Record<string, unknown>) => {
    const line = `[${prefix}] ${message}`;
    if (level === "error") console.error(line, context ?? "");
    else if (level === "warn") console.warn(line, context ?? "");
    else console.log(line, context ?? "");
  };
  return {
    debug: (m, c) => write("debug", m, c),
    info: (m, c) => write("info", m, c),
    warn: (m, c) => write("warn", m, c),
    error: (m, c) => write("error", m, c),
  };
}
