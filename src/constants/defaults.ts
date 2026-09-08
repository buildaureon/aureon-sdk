/**
 * @fileoverview Default runtime values for SDK clients and examples.
 */

import { OFFICIAL_API_BASE_URL } from "./networks.js";

/** Official AUREON API (https://api.aureonlabs.network). */
export const DEFAULT_API_BASE_URL = OFFICIAL_API_BASE_URL;

/** Operator-only local process. Users should not set this. */
export const LOCAL_API_BASE_URL = "http://127.0.0.1:8788";

export const DEFAULT_TIMEOUT_MS = 30_000;
export const SDK_VERSION = "0.1.9";
export const SDK_NAME = "@buildaureon/sdk";
export const PRODUCT_NAME = "AUREON";
export const PRODUCT_TAGLINE =
  "Financial Compass for Robinhood Chain";

export const REFERENCE_SYMBOLS = ["USDG", "NVDA", "AAPL", "GOOGL", "ETH"] as const;

/** HTTP header for product API keys. */
export const API_KEY_HEADER = "X-Aureon-Api-Key";

/** Per-request chain selector. Omit or `testnet` → 46630. `mainnet` → 4663. */
export const NETWORK_HEADER = "X-Aureon-Network";
