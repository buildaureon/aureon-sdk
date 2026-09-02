/**
 * @fileoverview Phase 2 audit trail export — objective → proof.
 *
 * Env:
 *   AUREON_API_KEY  issued developer key (required)
 *   AUREON_API_URL  optional
 *   AUREON_OBJECTIVE_ID  optional (defaults to first objective)
 *
 *   pnpm example:audit-trail
 */

import {
  createAureonClient,
  DEFAULT_API_BASE_URL,
  formatAuditTrailLines,
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

  const requested = process.env.AUREON_OBJECTIVE_ID?.trim();
  const objectiveId =
    requested || (await aureon.listObjectives())[0]?.id;
  if (!objectiveId) {
    throw new Error("No objectives on this wallet. Create one first.");
  }

  const trail = await aureon.getAuditTrail(objectiveId);

  console.log("\n=== AUREON Phase 2 — Financial audit trail ===\n");
  for (const line of formatAuditTrailLines(trail)) {
    console.log(line);
  }
  console.log("");
}

main().catch((error) => {
  if (isAureonError(error)) {
    console.error(`${error.code}: ${error.message}`);
  } else {
    console.error(error);
  }
  process.exitCode = 1;
});
