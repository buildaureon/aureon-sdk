/**
 * @fileoverview Minimal CLI against the AUREON API.
 *
 * Usage:
 *   pnpm --filter @aureon/sdk cli ping
 *   pnpm --filter @aureon/sdk cli login   # local preview only (devLogin)
 *   pnpm --filter @aureon/sdk cli me
 *   pnpm --filter @aureon/sdk cli portfolio
 *   pnpm --filter @aureon/sdk cli sync
 *   pnpm --filter @aureon/sdk cli objectives
 *
 * Env:
 *   AUREON_API_URL   — defaults to https://api.aureonlabs.network
 *   AUREON_API_KEY   — product key (X-Aureon-Api-Key)
 *   AUREON_TOKEN     — wallet Bearer session
 */

import {
  createAureonClient,
  createSessionTokenProvider,
  DEFAULT_API_BASE_URL,
  formatUsd,
  formatWeight,
  isAureonError,
} from "../src/index.js";

const session = createSessionTokenProvider(process.env.AUREON_TOKEN ?? null);

function client() {
  return createAureonClient({
    baseUrl: process.env.AUREON_API_URL ?? DEFAULT_API_BASE_URL,
    apiKey: process.env.AUREON_API_KEY ?? null,
    getAccessToken: session.getAccessToken,
  });
}

async function requireAuth(): Promise<ReturnType<typeof client>> {
  const aureon = client();
  if (session.getAccessToken()) return aureon;
  throw new Error(
    "No session. Set AUREON_TOKEN (wallet Bearer) or run a wallet verify flow in your app."
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
        hint: "devLogin is for local preview APIs only. Export AUREON_TOKEN for later commands.",
        token: login.token,
      });
    } catch (error) {
      const detail = isAureonError(error)
        ? `${error.code}: ${error.message}`
        : String(error);
      throw new Error(
        `devLogin failed (${detail}). Use wallet verify + AUREON_TOKEN against the hosted API.`
      );
    }
    return;
  }

  if (command === "me") {
    console.log(await (await requireAuth()).me());
    return;
  }

  if (command === "portfolio") {
    const portfolio = await (await requireAuth()).getPortfolio();
    console.log({
      totalNotionalUsd: formatUsd(portfolio.totalNotionalUsd),
      stableWeight: formatWeight(portfolio.stableWeight),
      positions: portfolio.positions,
    });
    return;
  }

  if (command === "sync") {
    const result = await (await requireAuth()).syncPortfolio();
    console.log({
      chainId: result.chainId,
      skippedZero: result.skippedZero,
      totalNotionalUsd: formatUsd(result.portfolio.totalNotionalUsd),
      positions: result.portfolio.positions,
    });
    return;
  }

  if (command === "objectives") {
    console.log(await (await requireAuth()).listObjectives());
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
