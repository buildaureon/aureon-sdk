/**
 * @fileoverview JSON HTTP transport used by AureonClient.
 */

import type { AureonLogger } from "../adapters/logging-adapter.js";
import {
  AureonError,
  AureonNetworkError,
  AureonTimeoutError,
} from "../errors/base.js";
import { errorFromHttpStatus } from "../errors/http.js";
import { joinUrl } from "./url.js";

export interface TransportOptions {
  baseUrl: string;
  fetchImpl: typeof fetch;
  headers: Record<string, string>;
  timeoutMs: number;
  maxRetries?: number;
  retryDelayMs?: number;
  logger?: AureonLogger;
  getAccessToken?: () =>
    | string
    | null
    | undefined
    | Promise<string | null | undefined>;
  getApiKey?: () =>
    | string
    | null
    | undefined
    | Promise<string | null | undefined>;
}

export interface RequestOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

function safeParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === "AbortError") ||
    (error instanceof Error && error.name === "AbortError")
  );
}

function isRetryableError(error: unknown): boolean {
  if (error instanceof AureonNetworkError || error instanceof AureonTimeoutError) {
    return true;
  }
  if (error instanceof AureonError) {
    return (
      typeof error.status === "number" &&
      (error.status >= 500 || error.status === 429)
    );
  }
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function requestJson<T>(
  transport: TransportOptions,
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const url = joinUrl(transport.baseUrl, path);
  const maxRetries = transport.maxRetries ?? 0;
  const retryDelayMs = transport.retryDelayMs ?? 250;
  let attempt = 0;

  while (true) {
    attempt += 1;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), transport.timeoutMs);
    const onAbort = () => controller.abort();

    if (options.signal) {
      if (options.signal.aborted) {
        clearTimeout(timeout);
        throw new AureonError("Request aborted", "ABORTED");
      }
      options.signal.addEventListener("abort", onAbort, { once: true });
    }

    try {
      const token = transport.getAccessToken
        ? await transport.getAccessToken()
        : null;
      const authHeaders: Record<string, string> = {};
      if (typeof token === "string" && token.trim().length > 0) {
        authHeaders.Authorization = `Bearer ${token.trim()}`;
      }

      const apiKey = transport.getApiKey
        ? await transport.getApiKey()
        : null;
      if (typeof apiKey === "string" && apiKey.trim().length > 0) {
        authHeaders["X-Aureon-Api-Key"] = apiKey.trim();
      }

      transport.logger?.debug("aureon.request", {
        method: options.method ?? (options.body !== undefined ? "POST" : "GET"),
        path,
        attempt,
      });

      const response = await transport.fetchImpl(url, {
        method: options.method ?? (options.body !== undefined ? "POST" : "GET"),
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...transport.headers,
          ...authHeaders,
          ...options.headers,
        },
        body:
          options.body !== undefined ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      });

      const text = await response.text();
      const parsed = text.length > 0 ? safeParseJson(text) : null;

      if (!response.ok) {
        throw errorFromHttpStatus(response.status, parsed ?? { message: text });
      }

      return parsed as T;
    } catch (error) {
      if (error instanceof AureonError && !isRetryableError(error)) {
        throw error;
      }
      if (isAbortError(error)) {
        const timeoutError = new AureonTimeoutError(
          "Request timed out or was aborted",
          { url, timeoutMs: transport.timeoutMs }
        );
        if (attempt <= maxRetries) {
          transport.logger?.warn("aureon.retry", {
            path,
            attempt,
            reason: "timeout",
          });
          await sleep(retryDelayMs);
          continue;
        }
        throw timeoutError;
      }
      if (error instanceof AureonError) {
        if (attempt <= maxRetries && isRetryableError(error)) {
          transport.logger?.warn("aureon.retry", {
            path,
            attempt,
            code: error.code,
            status: error.status,
          });
          await sleep(retryDelayMs);
          continue;
        }
        throw error;
      }
      const networkError = new AureonNetworkError(
        error instanceof Error ? error.message : "Network request failed",
        { url }
      );
      if (attempt <= maxRetries) {
        transport.logger?.warn("aureon.retry", {
          path,
          attempt,
          reason: "network",
        });
        await sleep(retryDelayMs);
        continue;
      }
      throw networkError;
    } finally {
      clearTimeout(timeout);
      if (options.signal) options.signal.removeEventListener("abort", onAbort);
    }
  }
}
