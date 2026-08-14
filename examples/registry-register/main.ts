/**
 * Phase 2 — prepare on-chain objective registration (wallet signs broadcast).
 *
 * Usage:
 *   AUREON_API_KEY=aur_... npx tsx examples/registry-register/main.ts
 */
import { createAureonClient } from "../../src/client/factory.js";

async function main() {
  const apiKey = process.env.AUREON_API_KEY?.trim();
  if (!apiKey) {
    console.error("Set AUREON_API_KEY");
    process.exit(1);
  }

  const client = createAureonClient({ apiKey });
  const status = await client.getRegistryStatus();
  console.log("registry status", status);

  const { objectives } = await client.listObjectives();
  const target = objectives[0];
  if (!target) {
    console.error("Create an objective first");
    process.exit(1);
  }

  const lookup = await client.getObjectiveRegistry(target.id);
  if (lookup.registered) {
    console.log("already registered", lookup.record);
    return;
  }

  const prepared = await client.prepareObjectiveRegistry(target.id);
  console.log("Sign and broadcast this tx from your wallet:");
  console.log(JSON.stringify(prepared, null, 2));
  console.log(
    "Then: client.confirmObjectiveRegistry(objectiveId, transactionHash)"
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
