/**
 * @fileoverview Objective vs actual allocation comparison and plan paradox detection.
 */

import type { DashboardOverview } from "../types/market.js";
import type { HealthState, ObjectiveHealth } from "../types/health.js";
import type { Objective, ObjectiveKind } from "../types/objective.js";

export interface AllocationComparisonRow {
  objectiveId: string;
  name: string;
  kind: ObjectiveKind;
  targetSymbol?: string;
  targetWeight: number;
  currentMetric: number;
  deviation: number;
  state: HealthState;
}

export interface PlanParadoxResult {
  detected: boolean;
  bookUp: boolean;
  offPlanCount: number;
  message: string;
}

const ACTIVE_STATUSES = new Set(["active", "validated"]);

function isOffPlan(state: HealthState): boolean {
  return state === "warning" || state === "violation";
}

/**
 * Joins active objectives with health records into target vs current rows.
 */
export function buildAllocationComparison(
  objectives: Objective[],
  health: ObjectiveHealth[]
): AllocationComparisonRow[] {
  const healthById = new Map(health.map((h) => [h.objectiveId, h]));

  return objectives
    .filter((o) => ACTIVE_STATUSES.has(o.status))
    .map((objective) => {
      const record = healthById.get(objective.id);
      const targetWeight =
        objective.policy?.targetWeight ?? record?.targetMetric ?? 0;
      const currentMetric = record?.currentMetric ?? 0;
      return {
        objectiveId: objective.id,
        name: objective.name,
        kind: objective.kind,
        targetSymbol: objective.policy?.targetSymbol,
        targetWeight,
        currentMetric,
        deviation: record?.deviation ?? currentMetric - targetWeight,
        state: record?.state ?? "paused",
      };
    });
}

/**
 * Detects when book performance looks fine but objectives are off-plan.
 */
export function detectPlanParadox(
  overview: DashboardOverview,
  health: ObjectiveHealth[]
): PlanParadoxResult {
  const offPlan = health.filter((h) => isOffPlan(h.state));
  const offPlanCount = offPlan.length;

  const bookUp =
    overview.change24hPct != null && !overview.change24hBaselineOnly
      ? overview.change24hPct >= 0
      : overview.attentionCount > 0 && overview.totalNotionalUsd > 0;

  const detected = bookUp && offPlanCount > 0;

  let message = "Portfolio and objectives are aligned.";
  if (detected) {
    const pct =
      overview.change24hPct != null && !overview.change24hBaselineOnly
        ? `${(overview.change24hPct * 100).toFixed(1)}%`
        : "recent activity";
    message = `Book is up (${pct}), but ${offPlanCount} objective${
      offPlanCount === 1 ? "" : "s"
    } are off-plan.`;
  } else if (offPlanCount > 0) {
    message = `${offPlanCount} objective${
      offPlanCount === 1 ? "" : "s"
    } need attention.`;
  }

  return { detected, bookUp, offPlanCount, message };
}
