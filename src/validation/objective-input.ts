/**
 * @fileoverview Validation and normalization for objective create/update payloads.
 */

import { AureonValidationError } from "../errors/base.js";
import type {
  CreateObjectiveInput,
  UpdateObjectiveInput,
} from "../types/objective.js";
import { isObjectiveKind, isObjectivePriority } from "../types/objective.js";

export function buildPolicySummary(
  kind: CreateObjectiveInput["kind"],
  targetWeight: number,
  tolerance: number
): string {
  const targetPct = (targetWeight * 100).toFixed(1);
  const tolPct = (tolerance * 100).toFixed(1);
  switch (kind) {
    case "stable_allocation":
      return `Maintain ${targetPct}% stable allocation within ±${tolPct}%`;
    case "balanced_portfolio":
      return `Hold balanced weights near ${targetPct}% primary sleeve within ±${tolPct}%`;
    case "risk_ceiling":
      return `Keep portfolio risk at or below configured ceiling with ${tolPct}% buffer`;
    case "reward_reinvestment":
      return `Reinvest available rewards toward ${targetPct}% target sleeve`;
    default:
      return `Objective policy target ${targetPct}% ±${tolPct}%`;
  }
}

export function normalizeCreateObjectiveInput(
  input: CreateObjectiveInput
): CreateObjectiveInput {
  const name = input.name?.trim();
  if (!name || name.length < 3) {
    throw new AureonValidationError("Objective name must be at least 3 characters");
  }
  if (!isObjectiveKind(input.kind)) {
    throw new AureonValidationError(`Unsupported objective kind: ${input.kind}`);
  }
  if (input.targetWeight < 0 || input.targetWeight > 1) {
    throw new AureonValidationError("targetWeight must be between 0 and 1");
  }
  if (input.tolerance < 0 || input.tolerance > 0.5) {
    throw new AureonValidationError("tolerance must be between 0 and 0.5");
  }
  const priority = input.priority ?? "high";
  if (!isObjectivePriority(priority)) {
    throw new AureonValidationError(`Unsupported priority: ${priority}`);
  }
  if (input.kind === "balanced_portfolio") {
    const symbol = input.targetSymbol?.trim().toUpperCase();
    if (!symbol) {
      throw new AureonValidationError(
        "balanced_portfolio requires targetSymbol"
      );
    }
    return {
      ...input,
      name,
      priority,
      targetSymbol: symbol,
      // SDK / agent path defaults to Automatic. Explicit "manual" is reserved
      // for the operator utility Approve UX; not recommended for integrations.
      automationMode: input.automationMode === "manual" ? "manual" : "auto",
    };
  }
  return {
    ...input,
    name,
    priority,
    targetSymbol: null,
    automationMode: input.automationMode === "manual" ? "manual" : "auto",
  };
}

export function normalizeUpdateObjectiveInput(
  input: UpdateObjectiveInput
): UpdateObjectiveInput {
  const next: UpdateObjectiveInput = { ...input };
  if (next.name !== undefined) {
    const name = next.name.trim();
    if (name.length < 3) {
      throw new AureonValidationError("Objective name must be at least 3 characters");
    }
    next.name = name;
  }
  if (next.targetWeight !== undefined) {
    if (next.targetWeight < 0 || next.targetWeight > 1) {
      throw new AureonValidationError("targetWeight must be between 0 and 1");
    }
  }
  if (next.tolerance !== undefined) {
    if (next.tolerance < 0 || next.tolerance > 0.5) {
      throw new AureonValidationError("tolerance must be between 0 and 0.5");
    }
  }
  if (next.priority !== undefined && !isObjectivePriority(next.priority)) {
    throw new AureonValidationError(`Unsupported priority: ${next.priority}`);
  }
  if (next.automationMode !== undefined) {
    throw new AureonValidationError(
      "automationMode cannot be changed after create: recreate the objective instead"
    );
  }
  return next;
}

export function assertId(value: string, label: string): void {
  if (!value || typeof value !== "string" || value.trim().length < 8) {
    throw new AureonValidationError(`Invalid ${label}`);
  }
}
