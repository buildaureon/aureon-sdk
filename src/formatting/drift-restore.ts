/**
 * @fileoverview Drift → detection → restore teaching flow helpers.
 */

import type { AllocationComparisonRow } from "./allocation.js";
import type { ExecutionReceipt, RestorePlan } from "../types/execution.js";
import type { ObjectiveHealth } from "../types/health.js";
import type { Objective } from "../types/objective.js";
import { buildPolicySummary } from "../validation/objective-input.js";

export type DriftRestorePhase = "aligned" | "drift_detected" | "restored";

export interface DriftRestoreFlow {
  objectiveId: string;
  rule: { summary: string; targetWeight: number; tolerance: number };
  phases: {
    aligned: {
      health: ObjectiveHealth;
      allocationRow?: AllocationComparisonRow;
    };
    drift: {
      health: ObjectiveHealth;
      allocationRow?: AllocationComparisonRow;
      restorePlan?: RestorePlan;
    };
    restored?: {
      health: ObjectiveHealth;
      receipt?: ExecutionReceipt;
      settlement?: string;
    };
  };
  currentPhase: DriftRestorePhase;
  message: string;
}

function isOffPlan(state: ObjectiveHealth["state"]): boolean {
  return state === "warning" || state === "violation";
}

/**
 * Infers drift-restore phase from a single health snapshot.
 */
export function inferDriftPhase(health: ObjectiveHealth): DriftRestorePhase {
  if (health.state === "healthy") return "aligned";
  if (isOffPlan(health.state)) return "drift_detected";
  return "aligned";
}

/**
 * Builds the drift → detection → restore teaching shape.
 */
export function buildDriftRestoreFlow(input: {
  objective: Objective;
  alignedHealth: ObjectiveHealth;
  driftHealth: ObjectiveHealth;
  driftPlan?: RestorePlan;
  restoredHealth?: ObjectiveHealth;
  receipt?: ExecutionReceipt;
  alignedRow?: AllocationComparisonRow;
  driftRow?: AllocationComparisonRow;
}): DriftRestoreFlow {
  const targetWeight =
    input.objective.policy?.targetWeight ??
    input.alignedHealth.targetMetric ??
    0;
  const tolerance =
    input.objective.policy?.tolerance ?? 0.02;
  const summary =
    input.objective.policy?.summary ??
    buildPolicySummary(input.objective.kind, targetWeight, tolerance);

  const restored = input.restoredHealth
    ? {
        health: input.restoredHealth,
        receipt: input.receipt,
        settlement: input.receipt?.settlement,
      }
    : undefined;

  const currentPhase: DriftRestorePhase = restored
    ? restored.health.state === "healthy" ||
      !isOffPlan(restored.health.state)
      ? "restored"
      : "drift_detected"
    : inferDriftPhase(input.driftHealth);

  let message =
    "Rule set and portfolio aligned. Ready to detect drift when marks move.";
  if (currentPhase === "drift_detected") {
    message =
      "We broke the rule on purpose. AUREON detected drift — allocation moved off policy.";
  } else if (currentPhase === "restored") {
    const settlement = input.receipt?.settlement ?? "staged";
    message = `Drift detected and restore completed (${settlement} settlement). Policy is back within tolerance.`;
  }

  return {
    objectiveId: input.objective.id,
    rule: { summary, targetWeight, tolerance },
    phases: {
      aligned: {
        health: input.alignedHealth,
        allocationRow: input.alignedRow,
      },
      drift: {
        health: input.driftHealth,
        allocationRow: input.driftRow,
        restorePlan: input.driftPlan,
      },
      restored,
    },
    currentPhase,
    message,
  };
}

/**
 * Read-only flow from current objective state + optional latest receipt.
 */
export function buildDriftRestoreFlowFromSnapshot(input: {
  objective: Objective;
  health: ObjectiveHealth;
  allocationRow?: AllocationComparisonRow;
  restorePlan?: RestorePlan;
  latestReceipt?: ExecutionReceipt;
}): DriftRestoreFlow {
  const targetWeight =
    input.objective.policy?.targetWeight ?? input.health.targetMetric ?? 0;

  const offPlan = isOffPlan(input.health.state);
  const hasRestore =
    input.latestReceipt &&
    input.latestReceipt.objectiveId === input.objective.id;

  if (!offPlan && !hasRestore) {
    return buildDriftRestoreFlow({
      objective: input.objective,
      alignedHealth: input.health,
      driftHealth: input.health,
      alignedRow: input.allocationRow,
      driftRow: input.allocationRow,
    });
  }

  if (offPlan) {
    return buildDriftRestoreFlow({
      objective: input.objective,
      alignedHealth: {
        ...input.health,
        state: "healthy",
        currentMetric: targetWeight,
        deviation: 0,
        message: "On track — still inside your target range.",
      },
      driftHealth: input.health,
      driftPlan: input.restorePlan,
      alignedRow: input.allocationRow,
      driftRow: input.allocationRow,
    });
  }

  return buildDriftRestoreFlow({
    objective: input.objective,
    alignedHealth: {
      ...input.health,
      state: "healthy",
      currentMetric: targetWeight,
      deviation: 0,
      message: "On track — still inside your target range.",
    },
    driftHealth: {
      ...input.health,
      state: "warning",
      message: "Prior drift detected.",
    },
    restoredHealth: input.health,
    receipt: input.latestReceipt,
    alignedRow: input.allocationRow,
    driftRow: input.allocationRow,
  });
}
