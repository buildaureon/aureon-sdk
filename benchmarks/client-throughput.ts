/**
 * @fileoverview Local micro-benchmark for validation helpers.
 */

import { performance } from "node:perf_hooks";
import { normalizeCreateObjectiveInput } from "../src/validation/objective-input.js";

const iterations = Number(process.env.AUREON_SDK_BENCH_ITERS ?? 5000);
const started = performance.now();
for (let i = 0; i < iterations; i += 1) {
  normalizeCreateObjectiveInput({
    name: `Objective ${i}`,
    kind: "stable_allocation",
    targetWeight: 0.2,
    tolerance: 0.02,
  });
}
const elapsedMs = performance.now() - started;
console.log(
  JSON.stringify(
    {
      iterations,
      elapsedMs: Number(elapsedMs.toFixed(3)),
      perCallMs: Number((elapsedMs / iterations).toFixed(6)),
    },
    null,
    2
  )
);
