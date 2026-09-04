/**
 * @fileoverview demo — drift → detection → restore.
 *
 * Shows the full loop: rule set, controlled drift, restore plan, receipt, health.
 *
 * Env:
 *   AUREON_API_KEY  issued developer key (required)
 *   AUREON_API_URL  optional (default https://api.aureonlabs.network)
 *
 *   pnpm example:drift-detect-restore
 */

import {
  createAureonClient,
  DEFAULT_API_BASE_URL,
  formatWeight,
  isAureonError,
  type DriftRestoreFlow,
} from "../../src/index.js";

function printPhase(label: string, healthState: string, metric?: number, target?: number): void {
  const metricStr =
    metric !== undefined && target !== undefined
      ? ` — ${formatWeight(metric)} vs ${formatWeight(target)} target`
      : "";
  console.log(`  ${label}: ${healthState}${metricStr}`);
}

function printFlow(flow: DriftRestoreFlow): void {
  console.log(`\nRule: ${flow.rule.summary}\n`);

  console.log("1. Rule — aligned on policy");
  printPhase(
    "   Health",
    flow.phases.aligned.health.state,
    flow.phases.aligned.health.currentMetric,
    flow.phases.aligned.health.targetMetric
  );

  console.log("\n2. Drift — NVDA rally broke the stable sleeve");
  printPhase(
    "   Health",
    flow.phases.drift.health.state,
    flow.phases.drift.health.currentMetric,
    flow.phases.drift.health.targetMetric
  );
  if (flow.phases.drift.restorePlan) {
    console.log(`   Restore plan: ${flow.phases.drift.restorePlan.message}`);
  }

  if (flow.phases.restored) {
    console.log("\n3. Restore — back within policy");
    printPhase(
      "   Health",
      flow.phases.restored.health.state,
      flow.phases.restored.health.currentMetric,
      flow.phases.restored.health.targetMetric
    );
    if (flow.phases.restored.receipt) {
      console.log(
        `   Receipt: ${flow.phases.restored.receipt.action} — settlement ${flow.phases.restored.receipt.settlement}`
      );
    }
  }

  console.log(`\n${flow.message}`);
  console.log(
    "\nWe broke the rule on purpose. AUREON detected it and restored the policy.\n"
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

  console.log("\n=== AUREON — Drift → detection → restore ===\n");

  const flow = await aureon.runDriftRestoreDemo();
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
