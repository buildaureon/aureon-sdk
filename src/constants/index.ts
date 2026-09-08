/**
 * @fileoverview Constants exports.
 */

export {
  DEFAULT_API_BASE_URL,
  LOCAL_API_BASE_URL,
  API_KEY_HEADER,
  DEFAULT_TIMEOUT_MS,
  PRODUCT_NAME,
  PRODUCT_TAGLINE,
  REFERENCE_SYMBOLS,
  SDK_NAME,
  SDK_VERSION,
} from "./defaults.js";
export {
  AUREON_NETWORKS,
  MAINNET_API_BASE_URL,
  MAINNET_CHAIN_ID,
  MAINNET_EXPLORER,
  TESTNET_API_BASE_URL,
  TESTNET_CHAIN_ID,
  TESTNET_EXPLORER,
  inferAureonNetworkFromUrl,
  resolveAureonNetwork,
  resolveAureonNetworkFromEnv,
  type AureonNetwork,
  type AureonNetworkPreset,
  type ResolveAureonNetworkInput,
} from "./networks.js";
export {
  ENDPOINTS,
  objectivePath,
  objectivePausePath,
  objectiveResumePath,
  objectiveRestorePlanPath,
  objectiveRestorePath,
  developerApiKeyPath,
} from "./endpoints.js";
