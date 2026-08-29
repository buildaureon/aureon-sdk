/**
 * @fileoverview Portfolio watch while away — agent-in-host teaching flow (Update 6).
 */

import type { AllocationComparisonRow } from "./allocation.js";
import type { ExecutionReceipt } from "../types/execution.js";
import type { MarketEvent } from "../types/market.js";
import type { ObjectiveHealth } from "../types/health.js";
import type { Objective } from "../types/objective.js";
import type { TimelineEvent } from "../types/timeline.js";
import { buildPolicySummary } from "../validation/objective-input.js";

export type AgentHost = "cursor" | "claude" | "mcp";

export type PortfolioWatchPhase =
  | "watch_registered"
  | "while_away"
  | "return_briefing";

/** Default consumer brief for Update 6 demos. */
export const DEFAULT_PORTFOLIO_WATCH_BRIEF =
  "Watch my portfolio while I'm away — keep about 20% in stable assets.";

export interface PortfolioWatchFlow {
  objectiveId: string;
  userBrief: string;
  host: AgentHost;
  phases: {
    register: {
      objectiveName: string;
      automationMode: string;
      policySummary: string;
      health: ObjectiveHealth;
      allocationRow?: AllocationComparisonRow;
    };
    whileAway?: {
      marketEventName: string;
      symbol: string;
      priceChangeRatio: number;
      healthBefore: ObjectiveHealth;
      healthAfter: ObjectiveHealth;
      autoRestored: boolean;
      receipt?: ExecutionReceipt;
    };
    briefing: {
      health: ObjectiveHealth;
      timelineEventCount: number;
      timelineEvents: TimelineEvent[];
      summaryLines: string[];
    };
  };
  currentPhase: PortfolioWatchPhase;
  message: string;
}

function isOffPlan(state: ObjectiveHealth["state"]): boolean {
  return state === "warning" || state === "violation";
}

/**
 * Infers portfolio-watch phase from register + optional while-away data.
 */
export function inferPortfolioWatchPhase(input: {
  registerHealth: ObjectiveHealth;
  whileAway?: PortfolioWatchFlow["phases"]["whileAway"];
}): PortfolioWatchPhase {
  if (input.whileAway) return "return_briefing";
  if (isOffPlan(input.registerHealth.state)) return "while_away";
  return "watch_registered";
}

/**
 * Builds human-readable briefing lines for agent hosts (Cursor / Claude).
 */
export function buildPortfolioWatchBriefingLines(input: {
  userBrief: string;
  host: AgentHost;
  objective: Objective;
  registerHealth: ObjectiveHealth;
  briefingHealth: ObjectiveHealth;
  whileAway?: PortfolioWatchFlow["phases"]["whileAway"];
  timelineEvents: TimelineEvent[];
}): string[] {
  const hostLabel =
    input.host === "cursor"
      ? "Cursor"
      : input.host === "claude"
        ? "Claude"
        : "MCP agent";
  const lines: string[] = [
    `You asked ${hostLabel} to watch your portfolio while away.`,
    `Policy registered: ${input.objective.name} (${input.objective.automationMode ?? "auto"} mode).`,
  ];

  if (input.whileAway) {
    lines.push(
      `While away: ${input.whileAway.symbol} moved ${(input.whileAway.priceChangeRatio * 100).toFixed(0)}% — health went from ${input.whileAway.healthBefore.state} to ${input.whileAway.healthAfter.state}.`
    );
    if (input.whileAway.autoRestored && input.whileAway.receipt) {
      lines.push(
        `Automatic restore ran — settlement ${input.whileAway.receipt.settlement}. Receipt id ${input.whileAway.receipt.id}.`
      );
    } else if (input.whileAway.autoRestored) {
      lines.push("Automatic restore ran — check executions for receipt.");
    } else {
      lines.push("No automatic restore fired — review health and restore plan.");
    }
  } else if (isOffPlan(input.briefingHealth.state)) {
    lines.push(
      `Portfolio is off-plan (${input.briefingHealth.state}) — agent should surface restore options.`
    );
  } else {
    lines.push("Portfolio remains within policy — no action required.");
  }

  if (input.timelineEvents.length > 0) {
    const types = [...new Set(input.timelineEvents.map((e) => e.type))].slice(
      0,
      4
    );
    lines.push(`Timeline: ${input.timelineEvents.length} recent event(s) — ${types.join(", ")}.`);
  }

  lines.push(`Current health: ${input.briefingHealth.state}.`);
  return lines;
}

/**
 * Builds the portfolio watch teaching shape for agent-in-host demos.
 */
export function buildPortfolioWatchFlow(input: {
  userBrief: string;
  host: AgentHost;
  objective: Objective;
  registerHealth: ObjectiveHealth;
  registerRow?: AllocationComparisonRow;
  whileAway?: {
    marketEvent: MarketEvent;
    healthBefore: ObjectiveHealth;
    healthAfter: ObjectiveHealth;
    autoRestored: boolean;
    receipt?: ExecutionReceipt;
  };
  briefingHealth: ObjectiveHealth;
  timelineEvents: TimelineEvent[];
}): PortfolioWatchFlow {
  const targetWeight =
    input.objective.policy?.targetWeight ??
    input.registerHealth.targetMetric ??
    0;
  const tolerance = input.objective.policy?.tolerance ?? 0.02;
  const policySummary =
    input.objective.policy?.summary ??
    buildPolicySummary(input.objective.kind, targetWeight, tolerance);

  const whileAway = input.whileAway
    ? {
        marketEventName: input.whileAway.marketEvent.name,
        symbol: input.whileAway.marketEvent.symbol,
        priceChangeRatio: input.whileAway.marketEvent.priceChangeRatio,
        healthBefore: input.whileAway.healthBefore,
        healthAfter: input.whileAway.healthAfter,
        autoRestored: input.whileAway.autoRestored,
        receipt: input.whileAway.receipt,
      }
    : undefined;

  const summaryLines = buildPortfolioWatchBriefingLines({
    userBrief: input.userBrief,
    host: input.host,
    objective: input.objective,
    registerHealth: input.registerHealth,
    briefingHealth: input.briefingHealth,
    whileAway,
    timelineEvents: input.timelineEvents,
  });

  const currentPhase = inferPortfolioWatchPhase({
    registerHealth: input.registerHealth,
    whileAway,
  });

  let message =
    "Tell your agent to watch the portfolio — intent becomes an Automatic objective, then read health and timeline when you return.";
  if (currentPhase === "return_briefing" && whileAway?.autoRestored) {
    message =
      "While you were away, the market moved and Automatic mode restored policy. Review the briefing — not a blank check, a registered rule.";
  } else if (currentPhase === "while_away" || isOffPlan(input.briefingHealth.state)) {
    message =
      "Portfolio drifted off-plan. The agent should report health and restore options — not discretionary trades.";
  }

  return {
    objectiveId: input.objective.id,
    userBrief: input.userBrief,
    host: input.host,
    phases: {
      register: {
        objectiveName: input.objective.name,
        automationMode: input.objective.automationMode ?? "auto",
        policySummary,
        health: input.registerHealth,
        allocationRow: input.registerRow,
      },
      whileAway,
      briefing: {
        health: input.briefingHealth,
        timelineEventCount: input.timelineEvents.length,
        timelineEvents: input.timelineEvents,
        summaryLines,
      },
    },
    currentPhase,
    message,
  };
}

/**
 * Read-only portfolio watch snapshot from current objective state.
 */
export function buildPortfolioWatchFlowFromSnapshot(input: {
  userBrief: string;
  host: AgentHost;
  objective: Objective;
  health: ObjectiveHealth;
  allocationRow?: AllocationComparisonRow;
  latestReceipt?: ExecutionReceipt;
  timelineEvents: TimelineEvent[];
}): PortfolioWatchFlow {
  return buildPortfolioWatchFlow({
    userBrief: input.userBrief,
    host: input.host,
    objective: input.objective,
    registerHealth: input.health,
    registerRow: input.allocationRow,
    briefingHealth: input.health,
    timelineEvents: input.timelineEvents,
  });
}
