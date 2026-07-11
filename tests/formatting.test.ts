/**
 * @fileoverview Formatting helper tests.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { formatUsd, formatWeight, healthTone } from "../src/formatting/display.js";

test("formatUsd renders currency", () => {
  assert.match(formatUsd(1234.5), /\$/);
});

test("formatWeight renders percent", () => {
  assert.equal(formatWeight(0.2), "20.0%");
});

test("healthTone maps violation to critical", () => {
  assert.equal(healthTone("violation"), "critical");
});
