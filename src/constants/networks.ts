/**
 * @fileoverview Robinhood Chain network presets for the SDK and MCP.
 *
 * Users call the official API: https://api.aureonlabs.network
 * `network` is a named parameter (`testnet` | `mainnet`), not a port.
 * Set `baseUrl` / `AUREON_API_URL` only to override the official host.
 */

export type AureonNetwork = "mainnet" | "testnet";

export const MAINNET_CHAIN_ID = 4663;
export const TESTNET_CHAIN_ID = 46630;

/** Official AUREON API. This is the default for integrators. */
export const OFFICIAL_API_BASE_URL = "https://api.aureonlabs.network";

/** Same host as the official API (current public deployment). */
export const TESTNET_API_BASE_URL = OFFICIAL_API_BASE_URL;

/** Same official hostname. Chain id is selected with `network`, not a port. */
export const MAINNET_API_BASE_URL = OFFICIAL_API_BASE_URL;

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
    baseUrl: OFFICIAL_API_BASE_URL,
    explorer: MAINNET_EXPLORER,
  },
  testnet: {
    network: "testnet",
    chainId: TESTNET_CHAIN_ID,
    baseUrl: OFFICIAL_API_BASE_URL,
    explorer: TESTNET_EXPLORER,
  },
};

export type ResolveAureonNetworkInput = {
  /** Omit for the official API (testnet 46630). Pass `mainnet` for chain 4663 on the same host. */
  network?: string | null;
  /** Override the official API URL. Users should leave this unset. */
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

function isOfficialApi(url: string): boolean {
  return stripSlash(url).toLowerCase().includes("api.aureonlabs.network");
}

/** Infer preset from a non-official host. Official API is shared — not exclusive. */
export function inferAureonNetworkFromUrl(url: string): AureonNetwork | null {
  if (isOfficialApi(url)) return null;
  const u = stripSlash(url).toLowerCase();
  if (/:(8787)(\/|$)/.test(u) || u.endsWith(":8787")) return "testnet";
  if (/:(8788)(\/|$)/.test(u) || u.endsWith(":8788")) return "mainnet";
  return null;
}

function mismatchMessage(network: AureonNetwork, baseUrl: string): string {
  return (
    `baseUrl "${baseUrl}" does not match network "${network}". ` +
    `The official API is ${OFFICIAL_API_BASE_URL}. ` +
    `Use the network parameter for chain selection, not a port.`
  );
}

/**
 * Resolve network + URL + chainId as one bundle.
 *
 * - Neither set → official API, testnet (46630).
 * - Only `network` → official API + that chain.
 * - Only `baseUrl` → that URL; official host stays testnet unless `network` is set.
 * - Both set: official host is always allowed. Other known hosts must match.
 */
export function resolveAureonNetwork(
  input: ResolveAureonNetworkInput = {}
): AureonNetworkPreset {
  const networkRaw = input.network?.trim();
  const networkSpecified = Boolean(networkRaw);
  const network = networkSpecified ? parseNetwork(networkRaw!) : "testnet";
  const explicitUrl = input.baseUrl?.trim();

  if (!explicitUrl) {
    return { ...AUREON_NETWORKS[network] };
  }

  const baseUrl = stripSlash(explicitUrl);
  if (isOfficialApi(baseUrl)) {
    const resolvedNetwork = networkSpecified ? network : "testnet";
    const preset = AUREON_NETWORKS[resolvedNetwork];
    return {
      network: resolvedNetwork,
      chainId: preset.chainId,
      baseUrl: OFFICIAL_API_BASE_URL,
      explorer: preset.explorer,
    };
  }

  const inferred = inferAureonNetworkFromUrl(baseUrl);
  if (networkSpecified && inferred && inferred !== network) {
    throw new Error(mismatchMessage(network, baseUrl));
  }

  const resolvedNetwork = networkSpecified ? network : (inferred ?? "testnet");
  const preset = AUREON_NETWORKS[resolvedNetwork];
  return {
    network: resolvedNetwork,
    chainId: preset.chainId,
    baseUrl,
    explorer: preset.explorer,
  };
}

/** MCP / CLI: `AUREON_NETWORK` optional, `AUREON_API_URL` overrides the official host. */
export function resolveAureonNetworkFromEnv(
  env: NodeJS.Dict<string> = process.env
): AureonNetworkPreset {
  return resolveAureonNetwork({
    network: env.AUREON_NETWORK,
    baseUrl: env.AUREON_API_URL,
  });
}
