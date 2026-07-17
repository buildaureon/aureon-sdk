/**
 * @fileoverview Objective domain types for Financial Compass Objectives.
 */

/** Lifecycle status for a Financial Compass Objective (FCO). */
export type ObjectiveStatus =
  | "draft"
  | "validated"
  | "active"
  | "paused"
  | "cancelled"
  | "completed";

/** Supported objective kinds for Phase 1 operator workflows. */
export type ObjectiveKind =
  | "stable_allocation"
  | "balanced_portfolio"
  | "risk_ceiling"
  | "reward_reinvestment";

/** Priority influences evaluation ordering when multiple objectives compete. */
export type ObjectivePriority = "low" | "medium" | "high" | "critical";

/**
 * Per-objective restore behaviour as stored on the API.
 *
 * SDK / agent integrations create objectives as **Automatic** (default).
 * `"manual"` exists so the operator utility can require an Approve click;
 * it is not part of the recommended SDK integration path.
 */
export type ObjectiveAutomationMode = "manual" | "auto";

/** Policy rules attached to an objective. */
export interface ObjectivePolicy {
  targetWeight: number;
  tolerance: number;
  maxRiskScore?: number;
  reinvestRatio?: number;
  /** Holding symbol when the objective tracks a specific asset weight. */
  targetSymbol?: string;
  summary: string;
}

/** Financial Compass Objective record. */
export interface Objective {
  id: string;
  name: string;
  kind: ObjectiveKind;
  status: ObjectiveStatus;
  priority: ObjectivePriority;
  /**
   * Restore mode for this objective.
   * SDK creates always set `"auto"`. `"manual"` is operator-utility only.
   */
  automationMode: ObjectiveAutomationMode;
  policy: ObjectivePolicy;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  lastEvaluatedAt: string | null;
  lastExecutionId: string | null;
}

/**
 * Input for creating a new objective.
 *
 * SDK create always sends `automationMode: "auto"` (Automatic restore).
 * Manual Approve is an operator-utility concern; do not rely on it in
 * agent / SDK loops.
 */
export interface CreateObjectiveInput {
  name: string;
  kind: ObjectiveKind;
  priority?: ObjectivePriority;
  targetWeight: number;
  tolerance: number;
  maxRiskScore?: number;
  reinvestRatio?: number;
  targetSymbol?: string | null;
  /**
   * @deprecated For SDK integrations omit this; create always uses Automatic.
   * The operator utility may still pass `"manual"` for Approve UX.
   */
  automationMode?: ObjectiveAutomationMode;
}

/** Partial update for an existing objective. */
export interface UpdateObjectiveInput {
  name?: string;
  priority?: ObjectivePriority;
  targetWeight?: number;
  tolerance?: number;
  maxRiskScore?: number;
  reinvestRatio?: number;
  /**
   * @deprecated Rejected on update; target token is fixed at create.
   * Recreate the objective to track a different holding.
   */
  targetSymbol?: never;
  /**
   * @deprecated Rejected on update; mode is fixed at create to avoid restore-flow issues.
   * Recreate the objective to switch Manual ↔ Automatic.
   */
  automationMode?: never;
}

export const OBJECTIVE_KINDS: readonly ObjectiveKind[] = [
  "stable_allocation",
  "balanced_portfolio",
  "risk_ceiling",
  "reward_reinvestment",
] as const;

export const OBJECTIVE_PRIORITIES: readonly ObjectivePriority[] = [
  "low",
  "medium",
  "high",
  "critical",
] as const;

export function isObjectiveKind(value: string): value is ObjectiveKind {
  return (OBJECTIVE_KINDS as readonly string[]).includes(value);
}

export function isObjectivePriority(value: string): value is ObjectivePriority {
  return (OBJECTIVE_PRIORITIES as readonly string[]).includes(value);
}
