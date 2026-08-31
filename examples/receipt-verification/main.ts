/**
 * @fileoverview receipt → verification.
 *
 * Shows claim vs validation vs settlement proof after a restore.
 *
 * Env:
 *   AUREON_API_KEY  issued developer key (required)
 *   AUREON_API_URL  optional (default https://api.aureonlabs.network)
 *
 *   pnpm example:receipt-verification
 */

import {
  createAureonClient,
  DEFAULT_API_BASE_URL,
  isAureonError,
  type ReceiptVerificationFlow,
} from "../../src/index.js";

function printFlow(flow: ReceiptVerificationFlow): void {
  console.log("\n=== AUREON — Receipt → verification ===\n");

  console.log("1. Claim — what the API/agent would call 'success'");
  console.log(`   Status:     ${flow.phases.claimed.status}`);
  console.log(`   Result:     ${flow.phases.claimed.result}`);
  console.log(`   Settlement: ${flow.phases.claimed.settlement}`);
  console.log(`   Summary:    ${flow.phases.claimed.summary}\n`);

  console.log("2. Validate — local honesty check (schema + settlement rules)");
  console.log(`   Valid:      ${flow.phases.validation.valid}`);
  if (!flow.phases.validation.valid) {
    for (const issue of flow.phases.validation.issues) {
      console.log(`   - ${issue.code}: ${issue.message}`);
    }
  }
  console.log(`   Proof tier: ${flow.proofTier}\n`);

  console.log("3. Verify — independent settlement lookup (vault only)");
  const settlement = flow.phases.settlement;
  if (settlement) {
    console.log(`   On-chain:   ${settlement.verifiedOnChain ? "yes" : "no"}`);
    if (settlement.settlement) {
      console.log(`   Block:      ${settlement.settlement.blockNumber}`);
      console.log(`   Explorer:   ${settlement.settlement.explorerUrl}`);
    } else {
      console.log("   Record:     (none yet — vault submitted but not observed)");
    }
  } else if (flow.receipt.settlement === "staged") {
    console.log("   Staged receipt — schema-valid, not chain-verified by design.");
  } else {
    console.log("   Settlement lookup unavailable for this receipt.");
  }

  const timelineCount = flow.phases.timelineEvents?.length ?? 0;
  if (timelineCount > 0) {
    console.log(`\n   Timeline:   ${timelineCount} linked event(s)`);
  }

  console.log(`\n${flow.message}`);
  console.log(
    "\nSuccess text is a claim. Validation and settlement records are how you verify it.\n"
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

  const flow = await aureon.runReceiptVerificationDemo();
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
