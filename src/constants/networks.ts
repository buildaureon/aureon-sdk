/**
 * @fileoverview Robinhood Chain network presets for the SDK and MCP.
 *
 * Default `network` is **mainnet** (chain 4663, local API 8788).
 * Public `api.aureonlabs.network` is still testnet 46630 — opt in with
 * `network: "testnet"` or `AUREON_NETWORK=testnet`. Do not map mainnet
 * to that host.
 */

export type AureonNetwork = "mainnet" | "testnet";

export const MAINNET_CHAIN_ID = 4663;
export const TESTNET_CHAIN_ID = 46630;

export const MAINNET_API_BASE_URL = "http://127.0.0.1:8788";
export const TESTNET_API_BASE_URL = "https://api.aureonlabs.network";

export const MAINNET_EXPLORER = "https://robinhoodchain.blockscout.com";
export const TESTNET_EXPLORER = "https://explorer.testnet.chain.robinhood.com";

export type AureonNetworkPreset = {
  network: AureonNetwork;
  chainId: number;
  baseUrl: string;
  explorer: string;
};

export const AUREON_NETWORKS: Record<AureonNetwork, AureonNetworkPreset> = {
  mainnet: {
    network: "mainnet",
    chainId: MAINNET_CHAIN_ID,
    baseUrl: MAINNET_API_BASE_URL,
    explorer: MAINNET_EXPLORER,
  },
  testnet: {
    network: "testnet",
    chainId: TESTNET_CHAIN_ID,
    baseUrl: TESTNET_API_BASE_URL,
    explorer: TESTNET_EXPLORER,
  },
};

export type ResolveAureonNetworkInput = {
  /** Omit to default mainnet, unless only `baseUrl` is set (then infer). */
  network?: string | null;
  /** Explicit API URL. Wins when set; mismatch with an explicit network throws. */
  baseUrl?: string | null;
};

function parseNetwork(raw: string): AureonNetwork {
  const n = raw.trim().toLowerCase();
  if (n === "mainnet" || n === "testnet") return n;
  throw new Error(
    `Unknown AUREON network "${raw}". Use "mainnet" or "testnet".`
  );
}

function stripSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

/** Infer preset from a known host. Custom URLs return null (allowed). */
export function inferAureonNetworkFromUrl(url: string): AureonNetwork | null {
  const u = stripSlash(url).toLowerCase();
  if (u.includes("api.aureonlabs.network")) return "testnet";
  if (/:(8787)(\/|$)/.test(u) || u.endsWith(":8787")) return "testnet";
  if (/:(8788)(\/|$)/.test(u) || u.endsWith(":8788")) return "mainnet";
  return null;
}

function mismatchMessage(network: AureonNetwork, baseUrl: string): string {
  return (
    `baseUrl "${baseUrl}" does not match network "${network}". ` +
    `mainnet is ${MAINNET_API_BASE_URL} (4663). ` +
    `testnet is ${TESTNET_API_BASE_URL} (46630; public host is still testnet).`
  );
}

/**
 * Resolve network + URL + chainId as one bundle.
 *
 * - Neither set → mainnet (8788 / 4663).
 * - Only `network` → that preset's URL.
 * - Only `baseUrl` → that URL; infer network from known hosts, else mainnet.
 * - Both set and they disagree (known hosts) → throw.
 */
export function resolveAureonNetwork(
  input: ResolveAureonNetworkInput = {}
): AureonNetworkPreset {
  const networkRaw = input.network?.trim();
  const networkSpecified = Boolean(networkRaw);
  const network = networkSpecified ? parseNetwork(networkRaw!) : "mainnet";
  const explicitUrl = input.baseUrl?.trim();

  if (!explicitUrl) {
    return { ...AUREON_NETWORKS[network] };
  }

  const baseUrl = stripSlash(explicitUrl);
  const inferred = inferAureonNetworkFromUrl(baseUrl);
  if (networkSpecified && inferred && inferred !== network) {
    throw new Error(mismatchMessage(network, baseUrl));
  }

  const resolvedNetwork = networkSpecified ? network : (inferred ?? "mainnet");
  const preset = AUREON_NETWORKS[resolvedNetwork];
  return {
    network: resolvedNetwork,
    chainId: preset.chainId,
    baseUrl,
    explorer: preset.explorer,
  };
}

/** MCP / CLI: `AUREON_NETWORK` optional, `AUREON_API_URL` still overrides. */
export function resolveAureonNetworkFromEnv(
  env: NodeJS.Dict<string> = process.env
): AureonNetworkPreset {
  return resolveAureonNetwork({
    network: env.AUREON_NETWORK,
    baseUrl: env.AUREON_API_URL,
  });
}
