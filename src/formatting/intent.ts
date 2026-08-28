/**
 * @fileoverview Financial intent → objective → portfolio flow helpers.
 */

import { AureonValidationError } from "../errors/base.js";
import type { ObjectiveHealth } from "../types/health.js";
import type {
  CreateObjectiveInput,
  Objective,
  ObjectiveKind,
  ObjectivePriority,
} from "../types/objective.js";
import type { PortfolioPosition, PortfolioSnapshot } from "../types/portfolio.js";
import { buildPolicySummary } from "../validation/objective-input.js";

export interface FinancialIntent {
  /** User or agent wording — what they want money to do. */
  brief: string;
  kind: ObjectiveKind;
  targetWeight: number;
  tolerance: number;
  targetSymbol?: string;
  name?: string;
  priority?: ObjectivePriority;
}

export interface ObjectivePortfolioFlow {
  intent: { brief: string; policySummary: string };
  objective: Objective;
  health: ObjectiveHealth | null;
  portfolio: {
    totalNotionalUsd: number;
    stableWeight: number;
    positions: PortfolioPosition[];
  };
  message: string;
}

const DEFAULT_TOLERANCE = 0.02;

function defaultName(intent: FinancialIntent): string {
  if (intent.name?.trim()) return intent.name.trim();
  const pct = (intent.targetWeight * 100).toFixed(0);
  switch (intent.kind) {
    case "stable_allocation":
      return `Maintain ${pct}% Stable Assets`;
    case "balanced_portfolio":
      return `Maintain ${pct}% ${intent.targetSymbol ?? "Sleeve"}`;
    case "risk_ceiling":
      return `Risk ceiling policy`;
    case "reward_reinvestment":
      return `Reinvest rewards toward ${pct}%`;
    default:
      return intent.brief.slice(0, 64);
  }
}

/**
 * Maps agent-extracted intent into a create-objective payload.
 */
export function resolveObjectiveFromIntent(
  intent: FinancialIntent
): CreateObjectiveInput {
  const brief = intent.brief?.trim();
  if (!brief || brief.length < 3) {
    throw new AureonValidationError("Intent brief must be at least 3 characters");
  }
  if (intent.targetWeight < 0 || intent.targetWeight > 1) {
    throw new AureonValidationError("targetWeight must be between 0 and 1");
  }
  const tolerance = intent.tolerance ?? DEFAULT_TOLERANCE;
  if (tolerance < 0 || tolerance > 0.5) {
    throw new AureonValidationError("tolerance must be between 0 and 0.5");
  }

  const base: CreateObjectiveInput = {
    name: defaultName(intent),
    kind: intent.kind,
    targetWeight: intent.targetWeight,
    tolerance,
    priority: intent.priority ?? "high",
    automationMode: "auto",
  };

  if (intent.kind === "balanced_portfolio") {
    const symbol = intent.targetSymbol?.trim().toUpperCase();
    if (!symbol) {
      throw new AureonValidationError(
        "balanced_portfolio intent requires targetSymbol"
      );
    }
    return { ...base, targetSymbol: symbol };
  }

  return base;
}

/**
 * Builds the AI → objective → portfolio teaching shape after create + read.
 */
export function buildObjectivePortfolioFlow(
  intent: FinancialIntent,
  objective: Objective,
  health: ObjectiveHealth | null,
  portfolio: PortfolioSnapshot
): ObjectivePortfolioFlow {
  const policySummary =
    objective.policy?.summary ??
    buildPolicySummary(intent.kind, intent.targetWeight, intent.tolerance);

  const state = health?.state ?? "paused";
  const current = health?.currentMetric;
  const target = health?.targetMetric ?? intent.targetWeight;

  let message =
    "Intent registered as objective. Portfolio is now scored against that policy.";
  if (health && state === "healthy") {
    message = `Portfolio aligns with intent — ${policySummary}.`;
  } else if (health && (state === "warning" || state === "violation")) {
    message = `Objective is active but portfolio is off-plan (${state}). Current ${((current ?? 0) * 100).toFixed(1)}% vs target ${(target * 100).toFixed(1)}%.`;
  }

  return {
    intent: { brief: intent.brief.trim(), policySummary },
    objective,
    health,
    portfolio: {
      totalNotionalUsd: portfolio.totalNotionalUsd,
      stableWeight: portfolio.stableWeight,
      positions: portfolio.positions,
    },
    message,
  };
}

/**
 * Lightweight rule-based parser for demo scripts.
 */
export function parseFinancialIntent(brief: string): FinancialIntent {
  const text = brief.trim();
  if (!text) {
    throw new AureonValidationError("Intent brief is required");
  }

  const stableMatch = text.match(
    /(\d+(?:\.\d+)?)\s*%?\s*(?:of\s+(?:my\s+)?portfolio\s+in\s+)?stable/i
  );
  if (stableMatch) {
    const pct = Number(stableMatch[1]) / 100;
    return {
      brief: text,
      kind: "stable_allocation",
      targetWeight: pct,
      tolerance: DEFAULT_TOLERANCE,
    };
  }

  const holdMatch = text.match(
    /(?:hold|keep|maintain)\s+(?:about\s+)?(\d+(?:\.\d+)?)\s*%?\s*(?:in\s+)?([A-Z]{2,10})/i
  );
  if (holdMatch) {
    const pct = Number(holdMatch[1]) / 100;
    const symbol = holdMatch[2]!.toUpperCase();
    if (symbol === "STABLE" || symbol === "STABLES") {
      return {
        brief: text,
        kind: "stable_allocation",
        targetWeight: pct,
        tolerance: DEFAULT_TOLERANCE,
      };
    }
    return {
      brief: text,
      kind: "balanced_portfolio",
      targetWeight: pct,
      tolerance: DEFAULT_TOLERANCE,
      targetSymbol: symbol,
    };
  }

  const pctOnly = text.match(/(\d+(?:\.\d+)?)\s*%/);
  if (pctOnly && /stable/i.test(text)) {
    return {
      brief: text,
      kind: "stable_allocation",
      targetWeight: Number(pctOnly[1]) / 100,
      tolerance: DEFAULT_TOLERANCE,
    };
  }

  throw new AureonValidationError(
    "Could not parse intent from brief — supply structured FinancialIntent fields"
  );
}
