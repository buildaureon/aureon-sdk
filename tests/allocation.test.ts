/**
 * @fileoverview Unit tests for allocation comparison and plan paradox helpers.
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAllocationComparison,
  detectPlanParadox,
} from "../src/formatting/allocation.js";
import type { Objective } from "../src/types/objective.js";
import type { ObjectiveHealth } from "../src/types/health.js";
import type { DashboardOverview } from "../src/types/market.js";

const baseObjective: Objective = {
  id: "obj-1",
  name: "Maintain 20% Stable Assets",
  kind: "stable_allocation",
  status: "active",
  priority: "high",
  automationMode: "auto",
  policy: {
    targetWeight: 0.2,
    tolerance: 0.02,
    targetSymbol: "USDG",
    summary: "Maintain 20% stable allocation",
  },
  ownerId: "0xabc",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  lastEvaluatedAt: "2026-01-01T00:00:00.000Z",
  lastExecutionId: null,
};

const baseHealth: ObjectiveHealth = {
  objectiveId: "obj-1",
  state: "healthy",
  score: 95,
  currentMetric: 0.2,
  targetMetric: 0.2,
  deviation: 0,
  message: "On target",
  evaluatedAt: "2026-01-01T00:00:00.000Z",
};

const baseOverview: DashboardOverview = {
  activeObjectives: 1,
  healthyCount: 1,
  warningCount: 0,
  violationCount: 0,
  pausedCount: 0,
  totalNotionalUsd: 100_000,
  stableWeight: 0.2,
  assetCount: 3,
  change24hUsd: 5000,
  change24hPct: 0.05,
  change24hBaselineOnly: false,
  change24hHasSnapshot: true,
  globalHealthScore: 95,
  healthHistory: [],
  attentionCount: 0,
  lastEvaluationAt: null,
  nextEvaluationAt: null,
  watchdogIntervalMs: null,
  lastWatchdogError: null,
  lastSyncedAt: null,
  recentEvents: [],
  recentExecutions: [],
};

test("buildAllocationComparison joins active objectives with health", () => {
  const rows = buildAllocationComparison([baseObjective], [baseHealth]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]!.targetWeight, 0.2);
  assert.equal(rows[0]!.currentMetric, 0.2);
  assert.equal(rows[0]!.state, "healthy");
});

test("buildAllocationComparison skips paused objectives", () => {
  const paused = { ...baseObjective, id: "obj-2", status: "paused" as const };
  const rows = buildAllocationComparison([baseObjective, paused], [baseHealth]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]!.objectiveId, "obj-1");
});

test("detectPlanParadox returns false when aligned", () => {
  const result = detectPlanParadox(baseOverview, [baseHealth]);
  assert.equal(result.detected, false);
  assert.equal(result.offPlanCount, 0);
});

test("detectPlanParadox detects green book with off-plan objectives", () => {
  const violated: ObjectiveHealth = {
    ...baseHealth,
    state: "violation",
    currentMetric: 0.121,
    deviation: -0.079,
    message: "Stable allocation below tolerance",
  };
  const overview = { ...baseOverview, attentionCount: 1, violationCount: 1 };
  const result = detectPlanParadox(overview, [violated]);
  assert.equal(result.detected, true);
  assert.equal(result.bookUp, true);
  assert.equal(result.offPlanCount, 1);
  assert.match(result.message, /off-plan/);
});

test("detectPlanParadox reports off-plan without book-up paradox", () => {
  const warning: ObjectiveHealth = { ...baseHealth, state: "warning" };
  const overview = {
    ...baseOverview,
    change24hPct: -0.03,
    attentionCount: 1,
    warningCount: 1,
  };
  const result = detectPlanParadox(overview, [warning]);
  assert.equal(result.detected, false);
  assert.equal(result.offPlanCount, 1);
  assert.match(result.message, /need attention/);
});
