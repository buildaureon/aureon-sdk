/**
 * @fileoverview Unit tests for portfolio watch while away helpers.
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPortfolioWatchBriefingLines,
  buildPortfolioWatchFlow,
  inferPortfolioWatchPhase,
  DEFAULT_PORTFOLIO_WATCH_BRIEF,
} from "../src/formatting/portfolio-watch.js";
import type { Objective } from "../src/types/objective.js";
import type { ObjectiveHealth } from "../src/types/health.js";
import type { MarketEvent } from "../src/types/market.js";

const objective: Objective = {
  id: "obj-watch",
  name: "Maintain 20% Stable Assets",
  kind: "stable_allocation",
  status: "active",
  automationMode: "auto",
  priority: "high",
  policy: {
    summary: "Maintain ~20% stable allocation (±2%)",
    targetWeight: 0.2,
    tolerance: 0.02,
  },
  ownerId: "0xabc",
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
  lastEvaluatedAt: "2026-09-01T00:00:00.000Z",
  lastExecutionId: null,
};

const healthy: ObjectiveHealth = {
  objectiveId: "obj-watch",
  state: "healthy",
  score: 95,
  currentMetric: 0.21,
  targetMetric: 0.2,
  deviation: 0.01,
  message: "Within tolerance",
  evaluatedAt: "2026-09-01T00:00:00.000Z",
};

const drift: ObjectiveHealth = {
  ...healthy,
  state: "warning",
  currentMetric: 0.14,
  deviation: 0.06,
  message: "Stable sleeve below target",
};

const marketEvent: MarketEvent = {
  id: "evt-1",
  name: "NVDA rally while you were away",
  description: "demo",
  symbol: "NVDA",
  priceChangeRatio: 0.45,
  appliedAt: "2026-09-01T01:00:00.000Z",
};

test("inferPortfolioWatchPhase maps register and while-away states", () => {
  assert.equal(
    inferPortfolioWatchPhase({ registerHealth: healthy }),
    "watch_registered"
  );
  assert.equal(
    inferPortfolioWatchPhase({ registerHealth: drift }),
    "while_away"
  );
  assert.equal(
    inferPortfolioWatchPhase({
      registerHealth: healthy,
      whileAway: {
        marketEventName: "x",
        symbol: "NVDA",
        priceChangeRatio: 0.45,
        healthBefore: drift,
        healthAfter: healthy,
        autoRestored: true,
      },
    }),
    "return_briefing"
  );
});

test("buildPortfolioWatchBriefingLines mentions host and auto restore", () => {
  const lines = buildPortfolioWatchBriefingLines({
    userBrief: DEFAULT_PORTFOLIO_WATCH_BRIEF,
    host: "cursor",
    objective,
    registerHealth: healthy,
    briefingHealth: healthy,
    whileAway: {
      marketEventName: marketEvent.name,
      symbol: "NVDA",
      priceChangeRatio: 0.45,
      healthBefore: drift,
      healthAfter: healthy,
      autoRestored: true,
      receipt: {
        id: "exec-1",
        objectiveId: "obj-watch",
        status: "confirmed",
        transactionHash: "staged_local_hash",
        action: "Rebalance",
        notionalAdjustedUsd: 500,
        result: "Restore complete",
        createdAt: "2026-09-01T01:00:01.000Z",
        confirmedAt: "2026-09-01T01:00:02.000Z",
        settlement: "staged",
        explorerUrl: null,
        verifiedOnChain: false,
      },
    },
    timelineEvents: [],
  });
  assert.ok(lines.some((l) => l.includes("Cursor")));
  assert.ok(lines.some((l) => l.includes("Automatic restore")));
});

test("buildPortfolioWatchFlow full while-away arc", () => {
  const flow = buildPortfolioWatchFlow({
    userBrief: DEFAULT_PORTFOLIO_WATCH_BRIEF,
    host: "claude",
    objective,
    registerHealth: healthy,
    whileAway: {
      marketEvent,
      healthBefore: drift,
      healthAfter: healthy,
      autoRestored: true,
    },
    briefingHealth: healthy,
    timelineEvents: [
      {
        id: "tl-1",
        objectiveId: "obj-watch",
        type: "execution_completed",
        message: "Restore completed — policy restored",
        payload: {},
        createdAt: "2026-09-01T01:00:02.000Z",
      },
    ],
  });
  assert.equal(flow.currentPhase, "return_briefing");
  assert.equal(flow.host, "claude");
  assert.ok(flow.phases.briefing.summaryLines.length >= 3);
  assert.ok(flow.message.includes("Automatic"));
});

test("buildPortfolioWatchFlow watch registered when no event", () => {
  const flow = buildPortfolioWatchFlow({
    userBrief: DEFAULT_PORTFOLIO_WATCH_BRIEF,
    host: "mcp",
    objective,
    registerHealth: healthy,
    briefingHealth: healthy,
    timelineEvents: [],
  });
  assert.equal(flow.currentPhase, "watch_registered");
  assert.equal(flow.phases.whileAway, undefined);
});

test("buildPortfolioWatchFlow off-plan without while-away messaging", () => {
  const flow = buildPortfolioWatchFlow({
    userBrief: DEFAULT_PORTFOLIO_WATCH_BRIEF,
    host: "cursor",
    objective,
    registerHealth: drift,
    briefingHealth: drift,
    timelineEvents: [],
  });
  assert.equal(flow.currentPhase, "while_away");
  assert.ok(flow.message.includes("off-plan"));
});
