/**
 * @fileoverview Timeline event contracts for append-only operator narratives.
 */

export type TimelineEventType =
  | "objective_created"
  | "objective_updated"
  | "objective_paused"
  | "objective_resumed"
  | "health_changed"
  | "violation_detected"
  | "evaluation_started"
  | "execution_started"
  | "execution_completed"
  | "market_event_applied"
  | "objective_restored"
  | "capital_provisioned"
  | "capital_cleared"
  | "capital_synced";

export interface TimelineEvent {
  id: string;
  objectiveId: string | null;
  type: TimelineEventType;
  message: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export const TIMELINE_EVENT_TYPES: readonly TimelineEventType[] = [
  "objective_created",
  "objective_updated",
  "objective_paused",
  "objective_resumed",
  "health_changed",
  "violation_detected",
  "evaluation_started",
  "execution_started",
  "execution_completed",
  "market_event_applied",
  "objective_restored",
  "capital_provisioned",
  "capital_cleared",
  "capital_synced",
] as const;

export function isTimelineEventType(value: string): value is TimelineEventType {
  return (TIMELINE_EVENT_TYPES as readonly string[]).includes(value);
}

export function filterTimelineByObjective(
  events: TimelineEvent[],
  objectiveId: string
): TimelineEvent[] {
  return events.filter((event) => event.objectiveId === objectiveId);
}
