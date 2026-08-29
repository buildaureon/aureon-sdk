/**
 * @fileoverview full AUREON loop (not a portfolio tracker).
 *
 * Env:
 *   AUREON_API_KEY  issued developer key (required)
 *   AUREON_API_URL  optional (default https://api.aureonlabs.network)
 *
 *   pnpm example:full-aureon-loop
 */

import {
  createAureonClient,
  DEFAULT_API_BASE_URL,
  formatWeight,
  isAureonError,
  type FullAureonLoopFlow,
} from "../../src/index.js";

function printFlow(flow: FullAureonLoopFlow): void {
  console.log("\n=== AUREON — Full loop (not a portfolio tracker) ===\n");

  console.log(`User brief: "${flow.userBrief}"\n`);

  console.log("1. Intent → objective");
  console.log(`   Objective:  ${flow.phases.intent.objectiveName}`);
  console.log(`   Policy:     ${flow.phases.intent.policySummary}`);
  console.log(`   Mode:       ${flow.phases.intent.automationMode}`);
  console.log(
    `   Baseline:   ${flow.phases.intent.health.state} — ${formatWeight(flow.phases.intent.health.currentMetric)} vs ${formatWeight(flow.phases.intent.health.targetMetric)}`
  );

  console.log("\n2. Plan check — green book can still fail the plan");
  console.log(
    `   After shock: ${flow.phases.planCheck.afterShock.health.state} — ${formatWeight(flow.phases.planCheck.afterShock.health.currentMetric)} vs ${formatWeight(flow.phases.planCheck.afterShock.health.targetMetric)}`
  );
  console.log(
    `   Paradox:     ${flow.phases.planCheck.afterShock.paradox.detected ? "yes" : "no"} — ${flow.phases.planCheck.afterShock.paradox.message}`
  );

  console.log("\n3. Drift → restore");
  console.log(
    `   Health:      ${flow.phases.driftRestore.healthBefore.state} → ${flow.phases.driftRestore.healthAfter.state}`
  );
  console.log(
    `   Receipt:     ${flow.phases.driftRestore.settlement} — ${flow.phases.driftRestore.receipt.id}`
  );

  console.log("\n4. Receipt → verification");
  console.log(
    `   Valid:       ${flow.phases.verification.phases.validation.valid}`
  );
  console.log(`   Proof tier:  ${flow.phases.verification.proofTier}`);
  console.log(`   Claim:       ${flow.phases.verification.phases.claimed.result}`);

  console.log(`\n${flow.message}`);
  console.log(
    "\nWe're not building another portfolio tracker. Intent → plan → restore → verify.\n"
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

  const flow = await aureon.runFullAureonLoopDemo();
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
