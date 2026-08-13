/**
 * @fileoverview Registry client unit tests.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { AureonClient } from "../src/client/aureon-client.js";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

test("getRegistryStatus calls /registry/status", async () => {
  let path = "";
  const fetchImpl: typeof fetch = async (url) => {
    path = String(url);
    return jsonResponse(200, {
      enabled: true,
      chainId: 46630,
      contractAddress: "0x1234567890123456789012345678901234567890",
      explorerBase: "https://explorer.testnet.chain.robinhood.com",
      network: "Robinhood Testnet",
    });
  };

  const client = new AureonClient({
    baseUrl: "https://api.aureonlabs.network",
    apiKey: "aur_test",
    fetch: fetchImpl,
    maxRetries: 0,
  });

  const status = await client.getRegistryStatus();
  assert.ok(path.endsWith("/registry/status"));
  assert.equal(status.enabled, true);
  assert.equal(status.chainId, 46630);
});

test("prepareObjectiveRegistry POSTs prepare-register path", async () => {
  let method = "";
  let path = "";
  const fetchImpl: typeof fetch = async (url, init) => {
    path = String(url);
    method = init?.method ?? "GET";
    return jsonResponse(200, {
      chainId: 46630,
      contractAddress: "0x1234567890123456789012345678901234567890",
      explorerBase: "https://explorer.testnet.chain.robinhood.com",
      objectiveId: "obj_test",
      objectiveKey: "0xabc",
      configHash: "0xdef",
      to: "0x1234567890123456789012345678901234567890",
      data: "0x",
      value: "0",
      functionName: "registerObjective",
    });
  };

  const client = new AureonClient({
    baseUrl: "https://api.aureonlabs.network",
    apiKey: "aur_test",
    fetch: fetchImpl,
    maxRetries: 0,
  });

  const prepared = await client.prepareObjectiveRegistry("obj_test");
  assert.equal(method, "POST");
  assert.ok(path.includes("/registry/objectives/obj_test/prepare-register"));
  assert.equal(prepared.functionName, "registerObjective");
});
