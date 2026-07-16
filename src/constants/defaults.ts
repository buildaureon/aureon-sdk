/**
 * @fileoverview Default runtime values for SDK clients and examples.
 */

/** Production AUREON API (public integrators). */
export const DEFAULT_API_BASE_URL = "https://api.aureonlabs.network";

/** Local monorepo preview only; not for public docs. */
export const LOCAL_API_BASE_URL = "http://127.0.0.1:8787";

export const DEFAULT_TIMEOUT_MS = 30_000;
export const SDK_VERSION = "0.1.0";
export const SDK_NAME = "@buildaureon/sdk";
export const PRODUCT_NAME = "AUREON";
export const PRODUCT_TAGLINE =
  "Financial Compass for Robinhood Chain";

export const REFERENCE_SYMBOLS = ["USDG", "NVDA", "AAPL", "GOOGL", "ETH"] as const;

/** HTTP header for product API keys. */
export const API_KEY_HEADER = "X-Aureon-Api-Key";
