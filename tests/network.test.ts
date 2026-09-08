/**
 * @fileoverview Network preset resolver tests.
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  AureonClient,
  LOCAL_API_BASE_URL,
  MAINNET_CHAIN_ID,
  OFFICIAL_API_BASE_URL,
  TESTNET_CHAIN_ID,
  createAureonClient,
  createLocalAureonClient,
  resolveAureonNetwork,
  resolveAureonNetworkFromEnv,
} from "../src/index.js";

test("omitted options resolve to the official API / testnet 46630", () => {
  const resolved = resolveAureonNetwork();
  assert.equal(resolved.network, "testnet");
  assert.equal(resolved.baseUrl, OFFICIAL_API_BASE_URL);
  assert.equal(resolved.chainId, TESTNET_CHAIN_ID);

  const client = createAureonClient();
  assert.equal(client.network, "testnet");
  assert.equal(client.baseUrl, OFFICIAL_API_BASE_URL);
  assert.equal(client.chainId, TESTNET_CHAIN_ID);
});

test("network mainnet keeps the official API and chain 4663", () => {
  const resolved = resolveAureonNetwork({ network: "mainnet" });
  assert.equal(resolved.network, "mainnet");
  assert.equal(resolved.baseUrl, OFFICIAL_API_BASE_URL);
  assert.equal(resolved.chainId, MAINNET_CHAIN_ID);

  const client = createAureonClient({ network: "mainnet" });
  assert.equal(client.network, "mainnet");
  assert.equal(client.baseUrl, OFFICIAL_API_BASE_URL);
  assert.equal(client.chainId, MAINNET_CHAIN_ID);
});

test("official URL is allowed with either network", () => {
  const asTestnet = resolveAureonNetwork({
    network: "testnet",
    baseUrl: `${OFFICIAL_API_BASE_URL}/`,
  });
  assert.equal(asTestnet.baseUrl, OFFICIAL_API_BASE_URL);
  assert.equal(asTestnet.network, "testnet");

  const asMainnet = resolveAureonNetwork({
    network: "mainnet",
    baseUrl: OFFICIAL_API_BASE_URL,
  });
  assert.equal(asMainnet.baseUrl, OFFICIAL_API_BASE_URL);
  assert.equal(asMainnet.network, "mainnet");
  assert.equal(asMainnet.chainId, MAINNET_CHAIN_ID);
});

test("only official baseUrl infers testnet", () => {
  const resolved = resolveAureonNetwork({
    baseUrl: OFFICIAL_API_BASE_URL,
  });
  assert.equal(resolved.network, "testnet");
  assert.equal(resolved.chainId, TESTNET_CHAIN_ID);
});

test("operator local 8788 with testnet throws", () => {
  assert.throws(
    () =>
      resolveAureonNetwork({
        network: "testnet",
        baseUrl: LOCAL_API_BASE_URL,
      }),
    /does not match network/
  );
});

test("createLocalAureonClient is operator-only local process", () => {
  const client = createLocalAureonClient();
  assert.equal(client.baseUrl, LOCAL_API_BASE_URL);
});

test("resolveAureonNetworkFromEnv omit → official API", () => {
  const prevNet = process.env.AUREON_NETWORK;
  const prevUrl = process.env.AUREON_API_URL;
  try {
    delete process.env.AUREON_NETWORK;
    delete process.env.AUREON_API_URL;
    const omitted = resolveAureonNetworkFromEnv();
    assert.equal(omitted.network, "testnet");
    assert.equal(omitted.baseUrl, OFFICIAL_API_BASE_URL);

    process.env.AUREON_NETWORK = "mainnet";
    const mainnet = resolveAureonNetworkFromEnv();
    assert.equal(mainnet.network, "mainnet");
    assert.equal(mainnet.baseUrl, OFFICIAL_API_BASE_URL);
    assert.equal(mainnet.chainId, MAINNET_CHAIN_ID);
  } finally {
    if (prevNet === undefined) delete process.env.AUREON_NETWORK;
    else process.env.AUREON_NETWORK = prevNet;
    if (prevUrl === undefined) delete process.env.AUREON_API_URL;
    else process.env.AUREON_API_URL = prevUrl;
  }
});

test("custom baseUrl with omitted network stays allowed", () => {
  const resolved = resolveAureonNetwork({
    baseUrl: "http://localhost:9999",
  });
  assert.equal(resolved.network, "testnet");
  assert.equal(resolved.baseUrl, "http://localhost:9999");
  assert.equal(resolved.chainId, TESTNET_CHAIN_ID);
});
