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

/** Supported objective kinds. */
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
 * Omit the field and create defaults to `"auto"`.
 * Pass `"manual"` for an unsigned restoration sleeve or reserve.
 */
export type ObjectiveAutomationMode = "manual" | "auto";

/**
 * ceiling: health misses only above targetWeight.
 * floor: health misses only below targetWeight.
 * target: health misses on both sides.
 */
export type WeightBound = "ceiling" | "floor" | "target";

/** Policy rules attached to an objective. */
export interface ObjectivePolicy {
  targetWeight: number;
  tolerance: number;
  maxRiskScore?: number;
  reinvestRatio?: number;
  /** Fraction of the notional above the sleeve cap to sell. Not a full rebalance. */
  profitTakeRatio?: number;
  /** ceiling, floor, or target. Omitted responses from older APIs mean target. */
  weightBound?: WeightBound;
  /** Holding symbol when the objective tracks a specific asset weight. */
  targetSymbol?: string;
  /** Max ETH for one agent hire. Absent means this objective has no hire cap. */
  hireLimitEth?: number;
  /** True when a hire inside the cap still needs the user. */
  hireApprovalRequired?: boolean;
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
   * `"auto"` is the default. `"manual"` is required for unsigned restoration.
   */
  automationMode: ObjectiveAutomationMode;
  policy: ObjectivePolicy;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  lastEvaluatedAt: string | null;
  lastExecutionId: string | null;
  verifiedOnChain?: boolean;
  configHash?: string;
}

/**
 * Input for creating a new objective.
 *
 * Omit `automationMode` for an Automatic objective.
 * Pass `"manual"` for an unsigned restoration sleeve or reserve.
 */
export interface CreateObjectiveInput {
  name: string;
  kind: ObjectiveKind;
  priority?: ObjectivePriority;
  targetWeight: number;
  tolerance: number;
  maxRiskScore?: number;
  reinvestRatio?: number;
  /** Fraction of the notional above the sleeve cap to sell. Not a full rebalance. */
  profitTakeRatio?: number;
  /** ceiling, floor, or target. Omit for the two-sided target check. */
  weightBound?: WeightBound;
  /** Max ETH for one agent hire against this objective. */
  hireLimitEth?: number;
  /** When true, a hire inside the cap returns authorization_required. */
  hireApprovalRequired?: boolean;
  targetSymbol?: string | null;
  /**
   * Omit for Automatic. Pass `"manual"` for unsigned restoration.
   * Locked after create.
   */
  automationMode?: ObjectiveAutomationMode;
  /** Optional note stored with the decision record. Empty is ignored. */
  reason?: string;
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
  /** Optional note stored with the decision record. Empty is ignored. */
  reason?: string;
}

export interface RestorationStep {
  role: "sleeve_profit_take" | "reserve_floor";
  to: string;
  data: string;
  value: "0";
  functionName: "rebalance";
  /** Raw buy-token units. Greater than zero. 99% of the mark-implied buy. */
  minOut: string;
}

export interface TransactionCheck {
  valid: boolean;
  issues: string[];
}

export interface SleeveRestoration {
  profitTakeRatio: number;
  targetWeight: number;
  currentWeight: number;
  excessWeight: number;
  excessNotionalUsd: number;
  sellNotionalUsd: number;
  fullReturnToTargetNotionalUsd: number;
  sellSymbol: string;
  buySymbol: string;
  amountHuman: string;
  conditionMet: boolean;
}

export interface ReserveRestoration {
  targetWeight: number;
  currentWeight: number;
  weightAfterSleeveSlice: number;
  floorShortfallUsd: number;
  sellSymbol: string;
  buySymbol: string;
  amountHuman: string;
  stepRequired: boolean;
}

export type PolicyDecision = "allow" | "refuse" | "authorization_required";

/** One proposed agent hire. The check does not send it. */
export interface PolicyCheckInput {
  agentId: string;
  taskId: string;
  objectiveId: string;
  action: {
    type: string;
    asset: string;
    amount: string | number;
    agent: string;
  };
}

/** Stored hire decision. actionId is the stored row, not a chain transaction. */
export interface PolicyCheckResult {
  decision: PolicyDecision;
  objectiveId: string;
  actionId: string;
  reason: string;
  policy: {
    passed: boolean;
    checks: string[];
  };
}

/** Unsigned vault steps. transactionHash and sentBy stay null. */
export interface RestorationProposal {
  sleeveObjectiveId: string | null;
  reserveObjectiveId: string | null;
  sleeve: SleeveRestoration | null;
  reserve: ReserveRestoration | null;
  steps: RestorationStep[];
  transactionCheck: TransactionCheck;
  transactionHash: null;
  sentBy: null;
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
