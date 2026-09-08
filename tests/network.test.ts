/**
 * @fileoverview Network preset resolver tests.
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  AureonClient,
  MAINNET_API_BASE_URL,
  MAINNET_CHAIN_ID,
  TESTNET_API_BASE_URL,
  TESTNET_CHAIN_ID,
  createAureonClient,
  createLocalAureonClient,
  resolveAureonNetwork,
  resolveAureonNetworkFromEnv,
} from "../src/index.js";

test("omitted network and baseUrl resolve to mainnet 8788 / 4663", () => {
  const resolved = resolveAureonNetwork();
  assert.equal(resolved.network, "mainnet");
  assert.equal(resolved.baseUrl, MAINNET_API_BASE_URL);
  assert.equal(resolved.chainId, MAINNET_CHAIN_ID);

  const client = createAureonClient();
  assert.equal(client.network, "mainnet");
  assert.equal(client.baseUrl, MAINNET_API_BASE_URL);
  assert.equal(client.chainId, MAINNET_CHAIN_ID);
});

test("network testnet resolves to public host / 46630", () => {
  const resolved = resolveAureonNetwork({ network: "testnet" });
  assert.equal(resolved.network, "testnet");
  assert.equal(resolved.baseUrl, TESTNET_API_BASE_URL);
  assert.equal(resolved.chainId, TESTNET_CHAIN_ID);

  const client = createAureonClient({ network: "testnet" });
  assert.equal(client.network, "testnet");
  assert.equal(client.baseUrl, TESTNET_API_BASE_URL);
  assert.equal(client.chainId, TESTNET_CHAIN_ID);
});

test("explicit matching baseUrl still wins", () => {
  const resolved = resolveAureonNetwork({
    network: "testnet",
    baseUrl: `${TESTNET_API_BASE_URL}/`,
  });
  assert.equal(resolved.baseUrl, TESTNET_API_BASE_URL);
  assert.equal(resolved.network, "testnet");

  const client = new AureonClient({
    network: "mainnet",
    baseUrl: MAINNET_API_BASE_URL,
  });
  assert.equal(client.baseUrl, MAINNET_API_BASE_URL);
});

test("only baseUrl to public host infers testnet without throw", () => {
  const resolved = resolveAureonNetwork({
    baseUrl: TESTNET_API_BASE_URL,
  });
  assert.equal(resolved.network, "testnet");
  assert.equal(resolved.chainId, TESTNET_CHAIN_ID);
});

test("mismatch mainnet + public host throws", () => {
  assert.throws(
    () =>
      resolveAureonNetwork({
        network: "mainnet",
        baseUrl: TESTNET_API_BASE_URL,
      }),
    /does not match network/
  );
  assert.throws(
    () =>
      createAureonClient({
        network: "testnet",
        baseUrl: MAINNET_API_BASE_URL,
      }),
    /does not match network/
  );
});

test("createLocalAureonClient uses mainnet 8788", () => {
  const client = createLocalAureonClient();
  assert.equal(client.network, "mainnet");
  assert.equal(client.baseUrl, MAINNET_API_BASE_URL);
  assert.equal(client.chainId, MAINNET_CHAIN_ID);
});

test("createLocalAureonClient rejects testnet override", () => {
  assert.throws(
    () => createLocalAureonClient({ network: "testnet" }),
    /mainnet-only/
  );
});

test("resolveAureonNetworkFromEnv omit → mainnet; AUREON_NETWORK=testnet → public host", () => {
  const prevNet = process.env.AUREON_NETWORK;
  const prevUrl = process.env.AUREON_API_URL;
  try {
    delete process.env.AUREON_NETWORK;
    delete process.env.AUREON_API_URL;
    const main = resolveAureonNetworkFromEnv();
    assert.equal(main.network, "mainnet");
    assert.equal(main.baseUrl, MAINNET_API_BASE_URL);

    process.env.AUREON_NETWORK = "testnet";
    const testnet = resolveAureonNetworkFromEnv();
    assert.equal(testnet.network, "testnet");
    assert.equal(testnet.baseUrl, TESTNET_API_BASE_URL);
    assert.equal(testnet.chainId, TESTNET_CHAIN_ID);
  } finally {
    if (prevNet === undefined) delete process.env.AUREON_NETWORK;
    else process.env.AUREON_NETWORK = prevNet;
    if (prevUrl === undefined) delete process.env.AUREON_API_URL;
    else process.env.AUREON_API_URL = prevUrl;
  }
});

test("port 8787 infers testnet; mismatch with mainnet throws", () => {
  const inferred = resolveAureonNetwork({
    baseUrl: "http://127.0.0.1:8787",
  });
  assert.equal(inferred.network, "testnet");
  assert.equal(inferred.chainId, TESTNET_CHAIN_ID);
  assert.throws(
    () =>
      resolveAureonNetwork({
        network: "mainnet",
        baseUrl: "http://127.0.0.1:8787",
      }),
    /does not match network/
  );
});

test("custom baseUrl with omitted network stays allowed", () => {
  const resolved = resolveAureonNetwork({
    baseUrl: "http://localhost:9999",
  });
  assert.equal(resolved.network, "mainnet");
  assert.equal(resolved.baseUrl, "http://localhost:9999");
  assert.equal(resolved.chainId, MAINNET_CHAIN_ID);
});
