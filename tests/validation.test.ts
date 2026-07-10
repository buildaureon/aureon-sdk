/**
 * @fileoverview Validation unit tests for @aureon/sdk.
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPolicySummary,
  normalizeCreateObjectiveInput,
  normalizeUpdateObjectiveInput,
} from "../src/validation/objective-input.js";
import { normalizeApplyMarketEventInput } from "../src/validation/market-input.js";
import { AureonValidationError } from "../src/errors/base.js";

test("normalizeCreateObjectiveInput defaults automationMode to auto", () => {
  const input = normalizeCreateObjectiveInput({
    name: "  Maintain 20% Stable Assets  ",
    kind: "stable_allocation",
    targetWeight: 0.2,
    tolerance: 0.02,
  });
  assert.equal(input.name, "Maintain 20% Stable Assets");
  assert.equal(input.priority, "high");
  assert.equal(input.automationMode, "auto");
});

test("normalizeCreateObjectiveInput allows explicit manual for operator utility", () => {
  const input = normalizeCreateObjectiveInput({
    name: "Manual Approve Objective",
    kind: "stable_allocation",
    targetWeight: 0.2,
    tolerance: 0.02,
    automationMode: "manual",
  });
  assert.equal(input.automationMode, "manual");
});

test("normalizeUpdateObjectiveInput rejects automationMode changes", () => {
  assert.throws(
    () =>
      normalizeUpdateObjectiveInput({
        automationMode: "manual",
      } as Parameters<typeof normalizeUpdateObjectiveInput>[0] & {
        automationMode: "manual";
      }),
    (err: unknown) =>
      err instanceof AureonValidationError &&
      /automationMode cannot be changed/i.test(err.message)
  );
});

test("buildPolicySummary includes target and tolerance", () => {
  const summary = buildPolicySummary("stable_allocation", 0.2, 0.02);
  assert.match(summary, /20\.0%/);
  assert.match(summary, /2\.0%/);
});

test("normalizeApplyMarketEventInput uppercases symbol", () => {
  const input = normalizeApplyMarketEventInput({
    symbol: "nvda",
    priceChangeRatio: 0.45,
  });
  assert.equal(input.symbol, "NVDA");
  assert.equal(input.autoRestore, true);
});
