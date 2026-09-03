/**
 * @fileoverview Unit tests for full AUREON loop helpers.
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  buildFullAureonLoopFlow,
  buildFullAureonLoopFlowFromSnapshot,
  inferFullAureonLoopPhase,
  DEFAULT_FULL_LOOP_BRIEF,
} from "../src/formatting/full-aureon-loop.js";
import type { Objective } from "../src/types/objective.js";
import type { ObjectiveHealth } from "../src/types/health.js";
import type { ExecutionReceipt } from "../src/types/execution.js";
import type { PlanParadoxResult } from "../src/formatting/allocation.js";

const objective: Objective = {
  id: "obj-loop",
  name: "Maintain 20% Stable Assets",
  kind: "stable_allocation",
  status: "active",
  automationMode: "auto",
  priority: "high",
  policy: {
    summary: "Maintain ~20% stable allocation (±2%)",
    targetWeight: 0.2,
    tolerance: 0.02,
  },
  ownerId: "0xabc",
  createdAt: "2026-09-03T00:00:00.000Z",
  updatedAt: "2026-09-03T00:00:00.000Z",
  lastEvaluatedAt: "2026-09-03T00:00:00.000Z",
  lastExecutionId: null,
};

const healthy: ObjectiveHealth = {
  objectiveId: "obj-loop",
  state: "healthy",
  score: 95,
  currentMetric: 0.21,
  targetMetric: 0.2,
  deviation: 0.01,
  message: "Within tolerance",
  evaluatedAt: "2026-09-03T00:00:00.000Z",
};

const drift: ObjectiveHealth = {
  ...healthy,
  state: "warning",
  currentMetric: 0.14,
  deviation: -0.06,
  message: "Stable sleeve below target",
};

const paradox: PlanParadoxResult = {
  detected: true,
  bookUp: true,
  offPlanCount: 1,
  message: "Book looks fine but objectives are off-plan.",
};

const stagedReceipt: ExecutionReceipt = {
  id: "exec-loop",
  objectiveId: "obj-loop",
  status: "confirmed",
  transactionHash: "staged_local_hash",
  action: "Rebalance toward stable allocation target",
  notionalAdjustedUsd: 500,
  result: "Transaction successful — staged book restore",
  createdAt: "2026-09-03T00:01:00.000Z",
  confirmedAt: "2026-09-03T00:01:01.000Z",
  settlement: "staged",
  explorerUrl: null,
  verifiedOnChain: false,
};

test("inferFullAureonLoopPhase maps restore and verification", () => {
  assert.equal(
    inferFullAureonLoopPhase({ hasRestore: false, verificationValid: false }),
    "plan_check"
  );
  assert.equal(
    inferFullAureonLoopPhase({ hasRestore: true, verificationValid: false }),
    "restored"
  );
  assert.equal(
    inferFullAureonLoopPhase({ hasRestore: true, verificationValid: true }),
    "verified"
  );
});

test("buildFullAureonLoopFlow full verified path", () => {
  const flow = buildFullAureonLoopFlow({
    userBrief: DEFAULT_FULL_LOOP_BRIEF,
    objective,
    baselineHealth: healthy,
    afterShockHealth: drift,
    paradox,
    restoredHealth: healthy,
    receipt: stagedReceipt,
  });
  assert.equal(flow.currentPhase, "verified");
  assert.equal(flow.phases.planCheck.afterShock.paradox.detected, true);
  assert.equal(flow.phases.verification.proofTier, "schema_valid");
  assert.ok(flow.message.includes("portfolio tracker"));
});

test("buildFullAureonLoopFlow includes intent and settlement", () => {
  const flow = buildFullAureonLoopFlow({
    userBrief: DEFAULT_FULL_LOOP_BRIEF,
    objective,
    baselineHealth: healthy,
    afterShockHealth: drift,
    paradox,
    restoredHealth: healthy,
    receipt: stagedReceipt,
  });
  assert.equal(flow.phases.intent.automationMode, "auto");
  assert.equal(flow.phases.driftRestore.settlement, "staged");
  assert.equal(flow.userBrief, DEFAULT_FULL_LOOP_BRIEF);
});

test("buildFullAureonLoopFlowFromSnapshot returns null without receipt", () => {
  const flow = buildFullAureonLoopFlowFromSnapshot({
    userBrief: DEFAULT_FULL_LOOP_BRIEF,
    objective,
    health: healthy,
    paradox: {
      detected: false,
      bookUp: true,
      offPlanCount: 0,
      message: "aligned",
    },
  });
  assert.equal(flow, null);
});

test("buildFullAureonLoopFlowFromSnapshot with receipt", () => {
  const flow = buildFullAureonLoopFlowFromSnapshot({
    userBrief: DEFAULT_FULL_LOOP_BRIEF,
    objective,
    health: healthy,
    paradox: {
      detected: false,
      bookUp: true,
      offPlanCount: 0,
      message: "aligned",
    },
    latestReceipt: stagedReceipt,
  });
  assert.ok(flow);
  assert.equal(flow!.objectiveId, "obj-loop");
  assert.equal(flow!.currentPhase, "verified");
});
