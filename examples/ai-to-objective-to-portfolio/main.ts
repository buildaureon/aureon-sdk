/**
 * @fileoverview Update 3 demo — AI → objective → portfolio.
 *
 * Env:
 *   AUREON_API_KEY  issued developer key (required)
 *   AUREON_API_URL  optional (default https://api.aureonlabs.network)
 *
 *   pnpm example:ai-to-objective-to-portfolio
 */

import {
  createAureonClient,
  DEFAULT_API_BASE_URL,
  formatWeight,
  isAureonError,
  parseFinancialIntent,
  type PortfolioPositionInput,
} from "../../src/index.js";

const DEMO_POSITIONS: PortfolioPositionInput[] = [
  {
    symbol: "USDG",
    name: "Paxos USDG",
    category: "stable",
    quantity: 24_000,
    markPriceUsd: 1,
  },
  {
    symbol: "NVDA",
    name: "NVIDIA Stock Token",
    category: "stock_token",
    quantity: 45,
    markPriceUsd: 920,
  },
  {
    symbol: "AAPL",
    name: "Apple Stock Token",
    category: "stock_token",
    quantity: 80,
    markPriceUsd: 210,
  },
  {
    symbol: "ETH",
    name: "Ether",
    category: "gas",
    quantity: 8.5,
    markPriceUsd: 3400,
  },
];

async function main(): Promise<void> {
  const apiKey = process.env.AUREON_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("Set AUREON_API_KEY to an issued developer key.");
  }

  const aureon = createAureonClient({
    baseUrl: process.env.AUREON_API_URL?.trim() || DEFAULT_API_BASE_URL,
    apiKey,
  });

  const userBrief =
    "I want to keep about 20% of my portfolio in stable assets.";

  console.log("\n=== AUREON Update 3 — AI → objective → portfolio ===\n");
  console.log("USER (simulated agent input):");
  console.log(`  "${userBrief}"\n`);

  console.log("AI — structured intent:");
  const intent = parseFinancialIntent(userBrief);
  console.log(
    JSON.stringify(
      {
        kind: intent.kind,
        targetWeight: intent.targetWeight,
        tolerance: intent.tolerance,
      },
      null,
      2
    )
  );

  console.log("\n1. Seed capital book…");
  await aureon.setPortfolio(DEMO_POSITIONS);

  console.log("2. Apply financial intent → create objective…");
  const flow = await aureon.applyFinancialIntent(intent);

  console.log("\n--- Intent ---");
  console.log(`  Brief:   ${flow.intent.brief}`);
  console.log(`  Policy:  ${flow.intent.policySummary}`);

  console.log("\n--- Objective ---");
  console.log(`  ID:      ${flow.objective.id}`);
  console.log(`  Kind:    ${flow.objective.kind}`);
  console.log(`  Mode:    ${flow.objective.automationMode}`);
  console.log(
    `  Target:  ${formatWeight(flow.objective.policy.targetWeight)}`
  );

  console.log("\n--- Portfolio ---");
  console.log(
    `  Book:    $${flow.portfolio.totalNotionalUsd.toLocaleString()}`
  );
  console.log(
    `  Stables: ${formatWeight(flow.portfolio.stableWeight)}`
  );
  if (flow.health) {
    console.log(
      `  Health:  ${flow.health.state} — current ${formatWeight(flow.health.currentMetric)} vs target ${formatWeight(flow.health.targetMetric)}`
    );
  }

  console.log(`\n${flow.message}`);
  console.log(
    "\nThe portfolio now has a reason — not just positions.\n"
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
