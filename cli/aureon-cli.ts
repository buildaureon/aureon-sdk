/**
 * @fileoverview Minimal CLI against the AUREON API.
 *
 * Usage:
 *   pnpm --filter @buildaureon/sdk cli ping
 *   pnpm --filter @buildaureon/sdk cli login   # local preview only (devLogin)
 *   pnpm --filter @buildaureon/sdk cli me
 *   pnpm --filter @buildaureon/sdk cli portfolio
 *   pnpm --filter @buildaureon/sdk cli sync
 *   pnpm --filter @buildaureon/sdk cli objectives
 *
 * Env:
 *   AUREON_NETWORK  — omit for mainnet (4663 / http://127.0.0.1:8788); set testnet for public host (still 46630)
 *   AUREON_API_URL  — optional override (must match network if both set)
 *   AUREON_API_KEY  — issued developer key (identifies wallet) or env bootstrap key
 *   AUREON_TOKEN    — optional wallet Bearer (required only with env bootstrap keys)
 *
 * Issued keys from the Developers console work alone for me/portfolio/sync/objectives.
 * Env bootstrap keys (`AUREON_API_KEYS` on the server) still need AUREON_TOKEN.
 * Private keys are only needed to broadcast on-chain deposit/withdraw txs — not for this CLI.
 */

import {
  createAureonClient,
  createSessionTokenProvider,
  formatUsd,
  formatWeight,
  isAureonError,
  resolveAureonNetworkFromEnv,
} from "../src/index.js";

const session = createSessionTokenProvider(process.env.AUREON_TOKEN ?? null);

function client() {
  const resolved = resolveAureonNetworkFromEnv();
  return createAureonClient({
    network: resolved.network,
    baseUrl: resolved.baseUrl,
    apiKey: process.env.AUREON_API_KEY ?? null,
    getAccessToken: session.getAccessToken,
  });
}

async function requireProductAccess(): Promise<ReturnType<typeof client>> {
  const aureon = client();
  if (process.env.AUREON_API_KEY?.trim() || session.getAccessToken()) {
    return aureon;
  }
  throw new Error(
    "Set AUREON_API_KEY (issued developer key preferred) or AUREON_TOKEN (wallet Bearer)."
  );
}

async function main(): Promise<void> {
  const [command = "ping"] = process.argv.slice(2);

  if (command === "ping") {
    console.log(await client().ping());
    return;
  }

  if (command === "login") {
    const aureon = client();
    try {
      const login = await aureon.devLogin();
      session.setToken(login.token);
      console.log({
        walletAddress: login.walletAddress,
        expiresAt: login.expiresAt,
        mode: login.mode ?? "session",
        hint: "devLogin is for local preview APIs only. Prefer an issued AUREON_API_KEY on production.",
        token: login.token,
      });
    } catch (error) {
      const detail = isAureonError(error)
        ? `${error.code}: ${error.message}`
        : String(error);
      throw new Error(
        `devLogin failed (${detail}). On production use an issued AUREON_API_KEY or wallet verify + AUREON_TOKEN.`
      );
    }
    return;
  }

  if (command === "me") {
    console.log(await (await requireProductAccess()).me());
    return;
  }

  if (command === "portfolio") {
    const portfolio = await (await requireProductAccess()).getPortfolio();
    console.log({
      totalNotionalUsd: formatUsd(portfolio.totalNotionalUsd),
      stableWeight: formatWeight(portfolio.stableWeight),
      positions: portfolio.positions,
    });
    return;
  }

  if (command === "sync") {
    const result = await (await requireProductAccess()).syncPortfolio();
    console.log({
      chainId: result.chainId,
      skippedZero: result.skippedZero,
      totalNotionalUsd: formatUsd(result.portfolio.totalNotionalUsd),
      positions: result.portfolio.positions,
    });
    return;
  }

  if (command === "objectives") {
    console.log(await (await requireProductAccess()).listObjectives());
    return;
  }

  throw new Error(
    `Unknown command: ${command}. Try ping | login | me | portfolio | sync | objectives`
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
