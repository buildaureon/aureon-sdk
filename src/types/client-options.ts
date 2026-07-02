/**
 * @fileoverview Client configuration types for AureonClient.
 */

import type { AureonLogger } from "../adapters/logging-adapter.js";
import { API_KEY_HEADER } from "../constants/defaults.js";

export interface AureonClientOptions {
  /**
   * Base URL of the AUREON API.
   * Defaults to `https://api.aureonlabs.network`.
   */
  baseUrl?: string;
  /**
   * Product API key sent as `X-Aureon-Api-Key` on every request.
   * Required for SDK / CLI / code when keys are enforced and there is no
   * wallet Bearer yet. The operator utility uses wallet Bearer only.
   */
  apiKey?: string | null;
  /**
   * Called before each request to resolve the product API key.
   * Prefer this for automations that load keys from env or a secret store.
   */
  getApiKey?: () => string | null | undefined | Promise<string | null | undefined>;
  /** Optional fetch implementation for non-browser runtimes. */
  fetch?: typeof fetch;
  /** Optional default headers merged into every request. */
  headers?: Record<string, string>;
  /** Request timeout in milliseconds. Defaults to 30000. */
  timeoutMs?: number;
  /**
   * Static Bearer session token. Prefer `getAccessToken` for apps that refresh
   * or clear sessions at runtime.
   */
  authToken?: string | null;
  /**
   * Called before each request to resolve the current Bearer token.
   * Return null/undefined to send the request without Authorization.
   */
  getAccessToken?: () => string | null | undefined | Promise<string | null | undefined>;
  /** Optional structured logger for request lifecycle diagnostics. */
  logger?: AureonLogger;
  /**
   * Extra attempts after the first failure for retryable errors
   * (network, timeout, 429, 5xx). Defaults to 0.
   */
  maxRetries?: number;
  /** Delay in ms between retries. Defaults to 250. */
  retryDelayMs?: number;
}

export const DEFAULT_TIMEOUT_MS = 30_000;

export function resolveTimeoutMs(options: AureonClientOptions): number {
  const value = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error("timeoutMs must be a positive finite number");
  }
  return value;
}

export function resolveHeaders(
  options: AureonClientOptions
): Record<string, string> {
  const headers: Record<string, string> = { ...(options.headers ?? {}) };
  const key = options.apiKey?.trim();
  if (key) {
    headers[API_KEY_HEADER] = key;
  }
  return headers;
}

export function resolveMaxRetries(options: AureonClientOptions): number {
  const value = options.maxRetries ?? 0;
  if (!Number.isInteger(value) || value < 0) {
    throw new Error("maxRetries must be a non-negative integer");
  }
  return value;
}

export function resolveRetryDelayMs(options: AureonClientOptions): number {
  const value = options.retryDelayMs ?? 250;
  if (!Number.isFinite(value) || value < 0) {
    throw new Error("retryDelayMs must be a non-negative finite number");
  }
  return value;
}
