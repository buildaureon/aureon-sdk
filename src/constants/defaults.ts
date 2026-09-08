/**
 * @fileoverview Default runtime values for SDK clients and examples.
 */

import { MAINNET_API_BASE_URL, TESTNET_API_BASE_URL } from "./networks.js";

/** Testnet public host (chain 46630). Not the omitted-options client default. */
export const DEFAULT_API_BASE_URL = TESTNET_API_BASE_URL;

/** Local mainnet API (chain 4663). Same as MAINNET_API_BASE_URL. */
export const LOCAL_API_BASE_URL = MAINNET_API_BASE_URL;

export const DEFAULT_TIMEOUT_MS = 30_000;
export const SDK_VERSION = "0.1.7";
export const SDK_NAME = "@buildaureon/sdk";
export const PRODUCT_NAME = "AUREON";
export const PRODUCT_TAGLINE =
  "Financial Compass for Robinhood Chain";

export const REFERENCE_SYMBOLS = ["USDG", "NVDA", "AAPL", "GOOGL", "ETH"] as const;

/** HTTP header for product API keys. */
export const API_KEY_HEADER = "X-Aureon-Api-Key";
