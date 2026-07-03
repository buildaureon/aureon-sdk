/**
 * @fileoverview Fetch adapter helpers for browser and Node runtimes.
 */

export type FetchLike = typeof fetch;

export function resolveFetch(custom?: FetchLike): FetchLike {
  if (custom) return custom.bind(custom);
  if (typeof globalThis.fetch !== "function") {
    throw new Error("No fetch implementation available in this runtime");
  }
  return globalThis.fetch.bind(globalThis);
}

export function mergeHeaders(
  base: Record<string, string>,
  extra?: Record<string, string>
): Record<string, string> {
  return { ...base, ...(extra ?? {}) };
}

export function userAgentHeader(version: string): Record<string, string> {
  return { "X-Aureon-SDK": `@aureon/sdk/${version}` };
}
