/**
 * @fileoverview Factory helpers for constructing AureonClient instances.
 */

import { MAINNET_API_BASE_URL } from "../constants/networks.js";
import type { AureonClientOptions } from "../types/client-options.js";
import { AureonClient } from "./aureon-client.js";

/**
 * Factory helper preferred by examples and quickstarts.
 * Omit `network` and `baseUrl` for local mainnet (4663 / 8788).
 * Pass `network: "testnet"` for the public host (still 46630).
 */
export function createAureonClient(
  options: AureonClientOptions = {}
): AureonClient {
  return new AureonClient(options);
}

/**
 * Creates a client pointed at the local mainnet API (8788 / 4663).
 */
export function createLocalAureonClient(
  overrides: Partial<AureonClientOptions> = {}
): AureonClient {
  if (overrides.network && overrides.network !== "mainnet") {
    throw new Error(
      "createLocalAureonClient is mainnet-only (8788 / 4663). Use createAureonClient({ network: \"testnet\" }) for the public host."
    );
  }
  return new AureonClient({
    ...overrides,
    network: "mainnet",
    baseUrl: overrides.baseUrl ?? MAINNET_API_BASE_URL,
  });
}
