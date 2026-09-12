/**
 * @fileoverview Quickstart — control-plane calls with an issued developer API key.
 *
 * Env (required for integrators — nothing else):
 *   AUREON_API_KEY     issued key from Developers
 *   AUREON_NETWORK     optional; omit for official API / mainnet; set testnet to stay on testnet
 *   AUREON_API_URL     optional override (must match network if both set)
 *
 *   pnpm --filter @buildaureon/sdk example:quickstart
 */

import {
  createAureonClient,
  formatWeight,
  isAureonError,
  resolveAureonNetworkFromEnv,
} from "../../src/index.js";

async function main(): Promise<void> {
  const apiKey = process.env.AUREON_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "Set AUREON_API_KEY to an issued developer key from the AUREON Developers page."
    );
  }

  const resolved = resolveAureonNetworkFromEnv();
  const aureon = createAureonClient({
    network: resolved.network,
    baseUrl: resolved.baseUrl,
    apiKey,
  });

  const ping = await aureon.ping();
  console.log("connected", ping);

  const me = await aureon.me();
  console.log("wallet", me.walletAddress);

  const synced = await aureon.syncPortfolio();
  console.log("synced", {
    chainId: synced.chainId,
    positions: synced.portfolio.positions.length,
    stableWeight: formatWeight(synced.portfolio.stableWeight),
  });

  const vault = await aureon.getVaultStatus();
  console.log("vault", {
    empty: vault.empty,
    canRestore: vault.canRestore,
    totalNotionalUsd: vault.totalNotionalUsd,
  });

  const objectives = await aureon.listObjectives();
  console.log(
    "objectives",
    objectives.map((o) => ({
      name: o.name,
      automationMode: o.automationMode,
    }))
  );

  console.log(
    "hint: empty vault restore is 409. prepare-deposit is unsigned — the user broadcasts when they fund. Agents do not."
  );
}

main().catch((error) => {
  if (isAureonError(error)) {
    console.error(`${error.code}: ${error.message}`);
  } else {
    console.error(error instanceof Error ? error.message : error);
  }
  process.exitCode = 1;
});
