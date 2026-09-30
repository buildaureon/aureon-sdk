/**
 * @fileoverview Financial history types: decisions, stored series, signed reports.
 */

export type DecisionAction = "set" | "change" | "pause" | "resume";

export interface DecisionRecord {
  id: string;
  objectiveId: string;
  action: DecisionAction;
  reason: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown>;
  executionId: string | null;
  createdAt: string;
}

export interface TimelinePage {
  events: import("./timeline.js").TimelineEvent[];
  nextBefore: string | null;
}

export interface PortfolioHistoryPoint {
  dayUtc: string;
  totalNotionalUsd: number;
  capturedAt: string;
}

export interface HealthHistoryPoint {
  at: string;
  score: number;
}

export interface FinancialReport {
  id: string;
  objectiveId: string;
  payload: Record<string, unknown>;
  payloadHash: string;
  message: string;
  signature: string | null;
  signer: string | null;
  verified: boolean;
  createdAt: string;
  signedAt: string | null;
}
