/**
 * @fileoverview Update 2 demo — green portfolio vs failing financial plan.
 *
 * Shows objective vs actual before and after a controlled NVDA rally with
 * auto-restore disabled so the paradox stays visible.
 *
 * Env:
 *   AUREON_API_KEY  issued developer key (required)
 *   AUREON_API_URL  optional (default https://api.aureonlabs.network)
 *
 *   pnpm example:green-vs-plan
 */

import {
  createAureonClient,
  DEFAULT_API_BASE_URL,
  formatWeight,
  isAureonError,
  type AllocationComparisonRow,
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

function printRows(rows: AllocationComparisonRow[]): void {
  if (rows.length === 0) {
    console.log("  (no active objectives)");
    return;
  }
  for (const row of rows) {
    const label = row.targetSymbol ?? row.name.slice(0, 20);
    console.log(
      `  ${label.padEnd(16)} current ${formatWeight(row.currentMetric)}  target ${formatWeight(row.targetWeight)}  ${row.state}`
    );
  }
}

async function main(): Promise<void> {
  const apiKey = process.env.AUREON_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("Set AUREON_API_KEY to an issued developer key.");
  }

  const aureon = createAureonClient({
    baseUrl: process.env.AUREON_API_URL?.trim() || DEFAULT_API_BASE_URL,
    apiKey,
  });

  console.log("\n=== AUREON Update 2 — Green vs plan ===\n");

  console.log("1. Seed capital book (~20% stables)…");
  await aureon.setPortfolio(DEMO_POSITIONS);

  console.log("2. Create stable allocation objective (20% ± 2%)…");
  const objective = await aureon.createObjective({
    name: "Maintain 20% Stable Assets",
    kind: "stable_allocation",
    targetWeight: 0.2,
    tolerance: 0.02,
  });

  console.log("3. Baseline — objective vs actual:\n");
  let snapshot = await aureon.getAllocationVsTarget();
  printRows(snapshot.rows);
  console.log(`\n  Book: $${snapshot.overview.totalNotionalUsd.toLocaleString()}`);
  console.log(`  Paradox: ${snapshot.paradox.message}\n`);

  console.log("4. Apply NVDA rally (+45%), autoRestore: false…");
  const market = await aureon.applyMarketEvent({
    name: "NVDA Stock Token Rally",
    description: "Controlled mark move — Update 2 paradox demo",
    symbol: "NVDA",
    priceChangeRatio: 0.45,
    autoRestore: false,
  });

  console.log("5. After shock — objective vs actual:\n");
  snapshot = await aureon.getAllocationVsTarget();
  printRows(snapshot.rows);

  const stable = snapshot.rows.find((r) => r.objectiveId === objective.id);
  const bookBefore = snapshot.overview.totalNotionalUsd;
  const bookAfter = market.portfolio.totalNotionalUsd;

  console.log(`\n  Book before shock: $${bookBefore.toLocaleString()}`);
  console.log(`  Book after shock:  $${bookAfter.toLocaleString()}`);
  console.log(`  Book moved up:     ${bookAfter >= bookBefore ? "yes" : "no"}`);
  if (stable) {
    console.log(
      `  Stable objective:  ${formatWeight(stable.currentMetric)} vs ${formatWeight(stable.targetWeight)} target — ${stable.state}`
    );
  }
  console.log(`\n  Paradox detected:  ${snapshot.paradox.detected}`);
  console.log(`  ${snapshot.paradox.message}\n`);

  if (!snapshot.paradox.detected && stable && stable.state !== "healthy") {
    console.log(
      "  Note: paradox flag needs book-up signal; objective is still off-plan.\n"
    );
  }
}

main().catch((error) => {
  if (isAureonError(error)) {
    console.error(`${error.code}: ${error.message}`);
  } else {
    console.error(error);
  }
  process.exitCode = 1;
});
