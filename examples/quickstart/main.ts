/**
 * @fileoverview Quickstart example for @aureon/sdk against the AUREON API.
 *
 * Env:
 *   AUREON_API_KEY  : product key (required on hosted API)
 *   AUREON_TOKEN    : wallet Bearer session
 *   AUREON_API_URL  : optional override (defaults to https://api.aureonlabs.network)
 *
 *   pnpm --filter @aureon/sdk example:quickstart
 */

import {
  createAureonClient,
  createSessionTokenProvider,
  DEFAULT_API_BASE_URL,
  formatWeight,
  isAureonError,
} from "../../src/index.js";

async function main(): Promise<void> {
  const session = createSessionTokenProvider(process.env.AUREON_TOKEN ?? null);
  const aureon = createAureonClient({
    baseUrl: process.env.AUREON_API_URL ?? DEFAULT_API_BASE_URL,
    apiKey: process.env.AUREON_API_KEY ?? null,
    getAccessToken: session.getAccessToken,
  });

  const ping = await aureon.ping();
  console.log("connected", ping);

  if (!session.getAccessToken()) {
    throw new Error(
      "Set AUREON_TOKEN from a wallet verify session (nonce → sign → verifyWallet)."
    );
  }

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
}

main().catch((error) => {
  if (isAureonError(error)) {
    console.error(`${error.code}: ${error.message}`);
  } else {
    console.error(error instanceof Error ? error.message : error);
  }
  process.exitCode = 1;
});
