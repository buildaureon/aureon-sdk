/**
 * @fileoverview Health Engine result types.
 */

export type HealthState = "healthy" | "warning" | "violation" | "paused";

export interface ObjectiveHealth {
  objectiveId: string;
  state: HealthState;
  score: number;
  currentMetric: number;
  targetMetric: number;
  deviation: number;
  message: string;
  evaluatedAt: string;
}

export function isHealthState(value: string): value is HealthState {
  return ["healthy", "warning", "violation", "paused"].includes(value);
}

export function healthRank(state: HealthState): number {
  switch (state) {
    case "healthy":
      return 0;
    case "warning":
      return 1;
    case "paused":
      return 2;
    case "violation":
      return 3;
    default:
      return 99;
  }
}

export function pickWorstHealth(records: ObjectiveHealth[]): ObjectiveHealth | null {
  if (records.length === 0) return null;
  return [...records].sort((a, b) => healthRank(b.state) - healthRank(a.state))[0] ?? null;
}
