/**
 * @fileoverview Full AUREON loop teaching flow helpers.
 */

import type {
  AllocationComparisonRow,
  PlanParadoxResult,
} from "./allocation.js";
import type { ReceiptVerificationFlow } from "./receipt-verification.js";
import { buildReceiptVerificationFlow } from "./receipt-verification.js";
import type { ExecutionReceipt } from "../types/execution.js";
import type { ObjectiveHealth } from "../types/health.js";
import type { Objective } from "../types/objective.js";
import { buildPolicySummary } from "../validation/objective-input.js";

export type FullAureonLoopPhase =
  | "intent"
  | "plan_check"
  | "restored"
  | "verified";

/** Default brief for full-loop demos. */
export const DEFAULT_FULL_LOOP_BRIEF =
  "Keep about 20% in stable assets — grow the book without abandoning the plan.";

export interface FullAureonLoopFlow {
  objectiveId: string;
  userBrief: string;
  phases: {
    intent: {
      objectiveName: string;
      policySummary: string;
      automationMode: string;
      health: ObjectiveHealth;
    };
    planCheck: {
      baselineAligned: boolean;
      afterShock: {
        health: ObjectiveHealth;
        allocationRow?: AllocationComparisonRow;
        paradox: PlanParadoxResult;
      };
    };
    driftRestore: {
      healthBefore: ObjectiveHealth;
      healthAfter: ObjectiveHealth;
      receipt: ExecutionReceipt;
      settlement: string;
    };
    verification: ReceiptVerificationFlow;
  };
  currentPhase: FullAureonLoopPhase;
  message: string;
}

/**
 * Infers loop phase from which stages are present.
 */
export function inferFullAureonLoopPhase(input: {
  hasRestore: boolean;
  verificationValid: boolean;
}): FullAureonLoopPhase {
  if (input.hasRestore && input.verificationValid) return "verified";
  if (input.hasRestore) return "restored";
  return "plan_check";
}

/**
 * Builds the full AUREON loop teaching shape.
 */
export function buildFullAureonLoopFlow(input: {
  userBrief: string;
  objective: Objective;
  baselineHealth: ObjectiveHealth;
  afterShockHealth: ObjectiveHealth;
  afterShockRow?: AllocationComparisonRow;
  paradox: PlanParadoxResult;
  restoredHealth: ObjectiveHealth;
  receipt: ExecutionReceipt;
  verification?: ReceiptVerificationFlow;
}): FullAureonLoopFlow {
  const targetWeight =
    input.objective.policy?.targetWeight ??
    input.baselineHealth.targetMetric ??
    0;
  const tolerance = input.objective.policy?.tolerance ?? 0.02;
  const policySummary =
    input.objective.policy?.summary ??
    buildPolicySummary(input.objective.kind, targetWeight, tolerance);

  const verification =
    input.verification ??
    buildReceiptVerificationFlow({ receipt: input.receipt });

  const currentPhase = inferFullAureonLoopPhase({
    hasRestore: true,
    verificationValid: verification.phases.validation.valid,
  });

  let message =
    "We're not building another portfolio tracker. AUREON registers intent, checks the plan, restores when off-plan, and verifies the receipt.";
  if (!verification.phases.validation.valid) {
    message =
      "Loop completed restore, but the receipt failed validation — do not treat success text as proof.";
  } else if (verification.proofTier === "chain_verified") {
    message =
      "Full loop complete: intent → plan check → restore → chain-verified receipt. Not a tracker — a Financial Compass.";
  } else {
    message =
      "Full loop complete: intent → plan check → restore → schema-valid receipt. We're not building another portfolio tracker.";
  }

  return {
    objectiveId: input.objective.id,
    userBrief: input.userBrief,
    phases: {
      intent: {
        objectiveName: input.objective.name,
        policySummary,
        automationMode: input.objective.automationMode ?? "auto",
        health: input.baselineHealth,
      },
      planCheck: {
        baselineAligned: input.baselineHealth.state === "healthy",
        afterShock: {
          health: input.afterShockHealth,
          allocationRow: input.afterShockRow,
          paradox: input.paradox,
        },
      },
      driftRestore: {
        healthBefore: input.afterShockHealth,
        healthAfter: input.restoredHealth,
        receipt: input.receipt,
        settlement: input.receipt.settlement,
      },
      verification,
    },
    currentPhase,
    message,
  };
}

/**
 * Read-only full-loop snapshot from current objective state + latest receipt.
 */
export function buildFullAureonLoopFlowFromSnapshot(input: {
  userBrief: string;
  objective: Objective;
  health: ObjectiveHealth;
  allocationRow?: AllocationComparisonRow;
  paradox: PlanParadoxResult;
  latestReceipt?: ExecutionReceipt;
  verification?: ReceiptVerificationFlow;
}): FullAureonLoopFlow | null {
  if (!input.latestReceipt) return null;

  const verification =
    input.verification ??
    buildReceiptVerificationFlow({ receipt: input.latestReceipt });

  return buildFullAureonLoopFlow({
    userBrief: input.userBrief,
    objective: input.objective,
    baselineHealth: input.health,
    afterShockHealth: input.health,
    afterShockRow: input.allocationRow,
    paradox: input.paradox,
    restoredHealth: input.health,
    receipt: input.latestReceipt,
    verification,
  });
}
