/**
 * @fileoverview Factory helpers for constructing AureonClient instances.
 */

import { LOCAL_API_BASE_URL } from "../constants/defaults.js";
import type { AureonClientOptions } from "../types/client-options.js";
import { AureonClient } from "./aureon-client.js";

/**
 * Factory for integrators. Omit `baseUrl` to use the official API
 * (https://api.aureonlabs.network). Omit `network` for mainnet. Pass
 * `network: "testnet"` to stay on testnet on the same host.
 */
export function createAureonClient(
  options: AureonClientOptions = {}
): AureonClient {
  return new AureonClient(options);
}

/**
 * Operator helper for a local API process. Integrators should use
 * createAureonClient() against the official API instead.
 */
export function createLocalAureonClient(
  overrides: Partial<AureonClientOptions> = {}
): AureonClient {
  return new AureonClient({
    ...overrides,
    baseUrl: overrides.baseUrl ?? LOCAL_API_BASE_URL,
  });
}
