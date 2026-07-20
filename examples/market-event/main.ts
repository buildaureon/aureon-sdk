/**
 * @fileoverview Controlled market-event rehearsal against the live AUREON API.
 *
 * Env:
 *   AUREON_API_KEY  issued developer key (required)
 *   AUREON_API_URL  optional (default https://api.aureonlabs.network)
 *
 *   pnpm --filter @buildaureon/sdk example:market
 */

import {
  createAureonClient,
  DEFAULT_API_BASE_URL,
  isAureonError,
} from "../../src/index.js";

async function main(): Promise<void> {
  const apiKey = process.env.AUREON_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("Set AUREON_API_KEY to an issued developer key.");
  }

  const aureon = createAureonClient({
    baseUrl: process.env.AUREON_API_URL?.trim() || DEFAULT_API_BASE_URL,
    apiKey,
  });

  const objective = await aureon.createObjective({
    name: "Maintain 20% Stable Assets",
    kind: "stable_allocation",
    targetWeight: 0.2,
    tolerance: 0.02,
  });

  const result = await aureon.applyMarketEvent({
    name: "NVDA Stock Token Rally",
    description: "Controlled mark appreciation on NVIDIA Stock Token",
    symbol: "NVDA",
    priceChangeRatio: 0.45,
    autoRestore: true,
  });

  console.log(
    JSON.stringify(
      {
        objectiveId: objective.id,
        eventId: result.event.id,
        executions: result.executions.length,
        settlement: result.executions[0]?.settlement ?? null,
        health: result.health.find((h) => h.objectiveId === objective.id)?.state,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  if (isAureonError(error)) {
    console.error(`${error.code}: ${error.message}`);
  } else {
    console.error(error);
  }
  process.exitCode = 1;
});
