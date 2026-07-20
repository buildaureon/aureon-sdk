/**
 * @fileoverview Quickstart example for @buildaureon/sdk against the AUREON API.
 *
 * Control plane (sync, vault status, objectives) needs an **issued** developer
 * API key from the utility Developers page. That key identifies your wallet —
 * no Bearer / private key required for these reads.
 *
 * Private key is only needed later to **broadcast** on-chain deposit/withdraw
 * steps returned by prepareVaultDeposit / prepareVaultWithdraw.
 *
 * Env:
 *   AUREON_API_KEY  : issued developer key (required on hosted API)
 *   AUREON_TOKEN    : optional Bearer (needed only with env bootstrap keys)
 *   AUREON_API_URL  : optional override (defaults to https://api.aureonlabs.network)
 *
 *   pnpm --filter @buildaureon/sdk example:quickstart
 */

import {
  createAureonClient,
  createSessionTokenProvider,
  DEFAULT_API_BASE_URL,
  formatWeight,
  isAureonError,
} from "../../src/index.js";

async function main(): Promise<void> {
  const apiKey = process.env.AUREON_API_KEY?.trim() ?? null;
  if (!apiKey) {
    throw new Error(
      "Set AUREON_API_KEY to an issued developer key from the AUREON Developers page."
    );
  }

  const session = createSessionTokenProvider(process.env.AUREON_TOKEN ?? null);
  const aureon = createAureonClient({
    baseUrl: process.env.AUREON_API_URL ?? DEFAULT_API_BASE_URL,
    apiKey,
    getAccessToken: session.getAccessToken,
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
    "hint: private key is only needed to sign/broadcast prepare-deposit or prepare-withdraw steps"
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
