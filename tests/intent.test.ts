/**
 * @fileoverview Unit tests for financial intent → objective → portfolio helpers.
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  buildObjectivePortfolioFlow,
  parseFinancialIntent,
  resolveObjectiveFromIntent,
} from "../src/formatting/intent.js";
import type { Objective } from "../src/types/objective.js";
import type { ObjectiveHealth } from "../src/types/health.js";
import type { PortfolioSnapshot } from "../src/types/portfolio.js";

const baseObjective: Objective = {
  id: "obj-1",
  name: "Maintain 20% Stable Assets",
  kind: "stable_allocation",
  status: "active",
  priority: "high",
  automationMode: "auto",
  policy: {
    targetWeight: 0.2,
    tolerance: 0.02,
    summary: "Maintain 20.0% stable allocation within ±2.0%",
  },
  ownerId: "0xabc",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  lastEvaluatedAt: "2026-01-01T00:00:00.000Z",
  lastExecutionId: null,
};

const baseHealth: ObjectiveHealth = {
  objectiveId: "obj-1",
  state: "healthy",
  score: 95,
  currentMetric: 0.2,
  targetMetric: 0.2,
  deviation: 0,
  message: "On target",
  evaluatedAt: "2026-01-01T00:00:00.000Z",
};

const basePortfolio: PortfolioSnapshot = {
  portfolioId: "pf-1",
  totalNotionalUsd: 100_000,
  stableWeight: 0.2,
  stockTokenWeight: 0.7,
  gasWeight: 0.1,
  positions: [],
  asOf: "2026-01-01T00:00:00.000Z",
};

test("parseFinancialIntent parses stable allocation brief", () => {
  const intent = parseFinancialIntent(
    "I want to keep about 20% of my portfolio in stable assets."
  );
  assert.equal(intent.kind, "stable_allocation");
  assert.equal(intent.targetWeight, 0.2);
});

test("parseFinancialIntent parses balanced portfolio brief", () => {
  const intent = parseFinancialIntent("Hold 30% NVDA in the portfolio");
  assert.equal(intent.kind, "balanced_portfolio");
  assert.equal(intent.targetWeight, 0.3);
  assert.equal(intent.targetSymbol, "NVDA");
});

test("resolveObjectiveFromIntent maps to create payload", () => {
  const input = resolveObjectiveFromIntent({
    brief: "Keep 20% stables",
    kind: "stable_allocation",
    targetWeight: 0.2,
    tolerance: 0.02,
  });
  assert.equal(input.kind, "stable_allocation");
  assert.equal(input.automationMode, "auto");
  assert.equal(input.targetWeight, 0.2);
});

test("buildObjectivePortfolioFlow links intent objective and portfolio", () => {
  const intent = {
    brief: "Keep 20% stables",
    kind: "stable_allocation" as const,
    targetWeight: 0.2,
    tolerance: 0.02,
  };
  const flow = buildObjectivePortfolioFlow(
    intent,
    baseObjective,
    baseHealth,
    basePortfolio
  );
  assert.match(flow.message, /aligns with intent/i);
  assert.equal(flow.intent.policySummary, baseObjective.policy.summary);
  assert.equal(flow.portfolio.stableWeight, 0.2);
});

test("buildObjectivePortfolioFlow reports off-plan state", () => {
  const intent = {
    brief: "Keep 20% stables",
    kind: "stable_allocation" as const,
    targetWeight: 0.2,
    tolerance: 0.02,
  };
  const violated = { ...baseHealth, state: "violation" as const, currentMetric: 0.12 };
  const flow = buildObjectivePortfolioFlow(
    intent,
    baseObjective,
    violated,
    { ...basePortfolio, stableWeight: 0.12 }
  );
  assert.match(flow.message, /off-plan/i);
});
