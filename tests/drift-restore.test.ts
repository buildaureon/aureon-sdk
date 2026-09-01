/**
 * @fileoverview Unit tests for drift → detection → restore helpers.
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDriftRestoreFlow,
  buildDriftRestoreFlowFromSnapshot,
  inferDriftPhase,
} from "../src/formatting/drift-restore.js";
import type { ExecutionReceipt } from "../src/types/execution.js";
import type { ObjectiveHealth } from "../src/types/health.js";
import type { Objective } from "../src/types/objective.js";

const baseObjective: Objective = {
  id: "obj-drift",
  name: "Maintain 20% Stable Assets",
  kind: "stable_allocation",
  status: "active",
  priority: "high",
  automationMode: "auto",
  policy: {
    targetWeight: 0.2,
    tolerance: 0.02,
    summary: "Maintain 20.0% stable allocation within ±2.0%",
  },
  ownerId: "0xabc",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  lastEvaluatedAt: "2026-01-01T00:00:00.000Z",
  lastExecutionId: null,
};

const alignedHealth: ObjectiveHealth = {
  objectiveId: "obj-drift",
  state: "healthy",
  score: 95,
  currentMetric: 0.2,
  targetMetric: 0.2,
  deviation: 0,
  message: "On target",
  evaluatedAt: "2026-01-01T00:00:00.000Z",
};

const driftHealth: ObjectiveHealth = {
  objectiveId: "obj-drift",
  state: "warning",
  score: 62,
  currentMetric: 0.12,
  targetMetric: 0.2,
  deviation: -0.08,
  message: "Stable allocation below target",
  evaluatedAt: "2026-01-01T01:00:00.000Z",
};

const restoredHealth: ObjectiveHealth = {
  objectiveId: "obj-drift",
  state: "healthy",
  score: 92,
  currentMetric: 0.19,
  targetMetric: 0.2,
  deviation: -0.01,
  message: "On target",
  evaluatedAt: "2026-01-01T02:00:00.000Z",
};

const receipt: ExecutionReceipt = {
  id: "exec-1",
  objectiveId: "obj-drift",
  status: "confirmed",
  transactionHash: "0xabc123",
  action: "restore",
  notionalAdjustedUsd: 8000,
  result: "Restored stable allocation",
  createdAt: "2026-01-01T02:00:00.000Z",
  confirmedAt: "2026-01-01T02:00:01.000Z",
  settlement: "staged",
};

test("inferDriftPhase maps health states", () => {
  assert.equal(inferDriftPhase(alignedHealth), "aligned");
  assert.equal(inferDriftPhase(driftHealth), "drift_detected");
  assert.equal(
    inferDriftPhase({ ...driftHealth, state: "violation" }),
    "drift_detected"
  );
});

test("buildDriftRestoreFlow full three-beat arc", () => {
  const flow = buildDriftRestoreFlow({
    objective: baseObjective,
    alignedHealth,
    driftHealth,
    driftPlan: {
      kind: "vault_swap",
      amountHuman: "8000",
      approxUsd: 8000,
      message: "Buy USDG to restore stable sleeve",
      sellSymbol: "NVDA",
      buySymbol: "USDG",
    },
    restoredHealth,
    receipt,
  });

  assert.equal(flow.objectiveId, "obj-drift");
  assert.equal(flow.rule.targetWeight, 0.2);
  assert.equal(flow.phases.aligned.health.state, "healthy");
  assert.equal(flow.phases.drift.health.state, "warning");
  assert.equal(flow.phases.drift.restorePlan?.kind, "vault_swap");
  assert.equal(flow.phases.restored?.health.state, "healthy");
  assert.equal(flow.phases.restored?.settlement, "staged");
  assert.equal(flow.currentPhase, "restored");
  assert.match(flow.message, /restore completed/i);
});

test("buildDriftRestoreFlow drift-only when no restore", () => {
  const flow = buildDriftRestoreFlow({
    objective: baseObjective,
    alignedHealth,
    driftHealth,
  });

  assert.equal(flow.currentPhase, "drift_detected");
  assert.match(flow.message, /broke the rule/i);
  assert.equal(flow.phases.restored, undefined);
});

test("buildDriftRestoreFlowFromSnapshot when currently off plan", () => {
  const flow = buildDriftRestoreFlowFromSnapshot({
    objective: baseObjective,
    health: driftHealth,
    restorePlan: {
      kind: "vault_swap",
      amountHuman: "8000",
      approxUsd: 8000,
      message: "Restore plan",
    },
  });

  assert.equal(flow.currentPhase, "drift_detected");
  assert.equal(flow.phases.drift.health.state, "warning");
  assert.equal(flow.phases.drift.restorePlan?.approxUsd, 8000);
});

test("buildDriftRestoreFlowFromSnapshot when healthy with receipt", () => {
  const flow = buildDriftRestoreFlowFromSnapshot({
    objective: baseObjective,
    health: restoredHealth,
    latestReceipt: receipt,
  });

  assert.equal(flow.currentPhase, "restored");
  assert.equal(flow.phases.restored?.receipt?.id, "exec-1");
});
