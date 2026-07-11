/**
 * @fileoverview Transport unit tests with stub fetch.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { AureonError } from "../src/errors/base.js";
import { requestJson, type TransportOptions } from "../src/transport/http.js";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function baseTransport(
  fetchImpl: typeof fetch,
  overrides: Partial<TransportOptions> = {}
): TransportOptions {
  return {
    baseUrl: "http://127.0.0.1:8787",
    fetchImpl,
    headers: {},
    timeoutMs: 5_000,
    maxRetries: 2,
    retryDelayMs: 1,
    ...overrides,
  };
}

test("maps 401 to UNAUTHORIZED", async () => {
  const fetchImpl = async () =>
    jsonResponse(401, { message: "Authentication is required" });

  await assert.rejects(
    () => requestJson(baseTransport(fetchImpl, { maxRetries: 0 }), "/auth/me"),
    (error: unknown) => {
      assert.ok(error instanceof AureonError);
      assert.equal(error.code, "UNAUTHORIZED");
      assert.equal(error.status, 401);
      assert.equal(error.retryable, false);
      return true;
    }
  );
});

test("attaches Authorization Bearer header", async () => {
  let seenAuth: string | null = null;
  const fetchImpl: typeof fetch = async (_url, init) => {
    const headers = new Headers(init?.headers);
    seenAuth = headers.get("Authorization");
    return jsonResponse(200, { ok: true });
  };

  const result = await requestJson<{ ok: boolean }>(
    baseTransport(fetchImpl, {
      getAccessToken: () => "test-token-123",
      maxRetries: 0,
    }),
    "/healthz"
  );

  assert.equal(result.ok, true);
  assert.equal(seenAuth, "Bearer test-token-123");
});

test("AureonClient sends X-Aureon-Api-Key from apiKey option", async () => {
  const { AureonClient } = await import("../src/client/aureon-client.js");
  let seenKey: string | null = null;
  const fetchImpl: typeof fetch = async (_url, init) => {
    const headers = new Headers(init?.headers);
    seenKey = headers.get("X-Aureon-Api-Key");
    return jsonResponse(200, { ok: true, service: "aureon-api", version: "0.2.0" });
  };

  const client = new AureonClient({
    baseUrl: "https://api.aureonlabs.network",
    apiKey: "aur_live_test_key",
    fetch: fetchImpl,
    maxRetries: 0,
  });
  await client.ping();
  assert.equal(seenKey, "aur_live_test_key");
});

test("retries once on 503 then succeeds", async () => {
  let calls = 0;
  const fetchImpl: typeof fetch = async () => {
    calls += 1;
    if (calls === 1) {
      return jsonResponse(503, { message: "temporarily unavailable" });
    }
    return jsonResponse(200, { ok: true, attempt: calls });
  };

  const result = await requestJson<{ ok: boolean; attempt: number }>(
    baseTransport(fetchImpl, { maxRetries: 2, retryDelayMs: 1 }),
    "/healthz"
  );

  assert.equal(result.ok, true);
  assert.equal(result.attempt, 2);
  assert.equal(calls, 2);
});
