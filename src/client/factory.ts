/**
 * @fileoverview Factory helpers for constructing AureonClient instances.
 */

import {
  DEFAULT_API_BASE_URL,
  LOCAL_API_BASE_URL,
} from "../constants/defaults.js";
import type { AureonClientOptions } from "../types/client-options.js";
import { AureonClient } from "./aureon-client.js";

/**
 * Factory helper preferred by examples and quickstarts.
 * Defaults to the production AUREON API URL when `baseUrl` is omitted.
 */
export function createAureonClient(
  options: AureonClientOptions = {}
): AureonClient {
  return new AureonClient({
    baseUrl: options.baseUrl ?? DEFAULT_API_BASE_URL,
    ...options,
  });
}

/**
 * Creates a client pointed at a local AUREON API process (monorepo operators).
 * Not advertised in the public README.
 */
export function createLocalAureonClient(
  overrides: Partial<AureonClientOptions> = {}
): AureonClient {
  return new AureonClient({
    ...overrides,
    baseUrl: overrides.baseUrl ?? LOCAL_API_BASE_URL,
  });
}
