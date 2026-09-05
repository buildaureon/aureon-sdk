/**
 * @fileoverview demo — portfolio watch while away (agent-in-host).
 *
 * Env:
 *   AUREON_API_KEY  issued developer key (required)
 *   AUREON_API_URL  optional (default https://api.aureonlabs.network)
 *
 *   pnpm example:portfolio-watch
 */

import {
  createAureonClient,
  DEFAULT_API_BASE_URL,
  formatWeight,
  isAureonError,
  type PortfolioWatchFlow,
} from "../../src/index.js";

function printFlow(flow: PortfolioWatchFlow): void {
  console.log("\n=== AUREON — Watch while away (Cursor / Claude + MCP) ===\n");

  console.log(`User brief: "${flow.userBrief}"`);
  console.log(`Agent host: ${flow.host}\n`);

  console.log("1. Register watch — intent → Automatic objective");
  console.log(`   Objective:  ${flow.phases.register.objectiveName}`);
  console.log(`   Mode:       ${flow.phases.register.automationMode}`);
  console.log(`   Policy:     ${flow.phases.register.policySummary}`);
  console.log(
    `   Health:     ${flow.phases.register.health.state} — ${formatWeight(flow.phases.register.health.currentMetric ?? 0)} vs ${formatWeight(flow.phases.register.health.targetMetric ?? 0.2)} target`
  );

  if (flow.phases.whileAway) {
    console.log("\n2. While away — market moved, Automatic mode acted");
    console.log(
      `   Event:      ${flow.phases.whileAway.marketEventName} (${flow.phases.whileAway.symbol} ${(flow.phases.whileAway.priceChangeRatio * 100).toFixed(0)}%)`
    );
    console.log(
      `   Health:     ${flow.phases.whileAway.healthBefore.state} → ${flow.phases.whileAway.healthAfter.state}`
    );
    console.log(
      `   Auto restore: ${flow.phases.whileAway.autoRestored ? "yes" : "no"}`
    );
    if (flow.phases.whileAway.receipt) {
      console.log(
        `   Receipt:    ${flow.phases.whileAway.receipt.settlement} — ${flow.phases.whileAway.receipt.id}`
      );
    }
  }

  console.log("\n3. Return briefing — what to tell the user");
  for (const line of flow.phases.briefing.summaryLines) {
    console.log(`   • ${line}`);
  }

  console.log(`\n${flow.message}`);
  console.log(
    "\nYou don't hand the agent a blank check — you register a rule, then read the briefing when you're back.\n"
  );
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

  const flow = await aureon.runPortfolioWatchDemo({ host: "cursor" });
  printFlow(flow);
}

main().catch((error) => {
  if (isAureonError(error)) {
    console.error(`${error.code}: ${error.message}`);
  } else {
    console.error(error);
  }
  process.exitCode = 1;
});
