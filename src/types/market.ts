/**
 * @fileoverview Controlled market event types for operator demos and rehearsals.
 */

export interface MarketEvent {
  id: string;
  name: string;
  description: string;
  symbol: string;
  priceChangeRatio: number;
  appliedAt: string;
}

export interface MarketPreset {
  name: string;
  description: string;
  symbol: string;
  priceChangeRatio: number;
}

export interface ApplyMarketEventInput {
  name?: string;
  description?: string;
  symbol: string;
  priceChangeRatio: number;
  autoRestore?: boolean;
}

export interface DashboardOverview {
  activeObjectives: number;
  healthyCount: number;
  warningCount: number;
  violationCount: number;
  pausedCount: number;
  totalNotionalUsd: number;
  stableWeight: number;
  /** Holdings count from the capital book. */
  assetCount: number;
  /** Absolute USD change vs prior UTC day snapshot; null when baseline only. */
  change24hUsd: number | null;
  /** Fractional change (0.05 = +5%); null when baseline only. */
  change24hPct: number | null;
  /** True when no prior-day snapshot exists yet. */
  change24hBaselineOnly: boolean;
  /** True when today's snapshot row exists. */
  change24hHasSnapshot: boolean;
  /** Average health score across non-paused objectives; null when none. */
  globalHealthScore: number | null;
  /** Persisted health samples (oldest → newest), up to ~90 days. */
  healthHistory: Array<{ at: string; score: number }>;
  /** warning + violation count. */
  attentionCount: number;
  /** Last successful live-mark watchdog evaluation (not overview poll). */
  lastEvaluationAt: string | null;
  /** lastEvaluationAt + watchdog interval when continuous monitor is configured. */
  nextEvaluationAt: string | null;
  watchdogIntervalMs: number | null;
  /** Last background/manual watchdog failure message, if any. */
  lastWatchdogError: string | null;
  lastSyncedAt: string | null;
  recentExecutions: import("./execution.js").ExecutionReceipt[];
  recentEvents: import("./timeline.js").TimelineEvent[];
}

export function normalizeSymbol(symbol: string): string {
  return symbol.trim().toUpperCase();
}

export function describeMarketMove(event: MarketEvent): string {
  const pct = (event.priceChangeRatio * 100).toFixed(2);
  return `${event.symbol} mark moved ${pct}% (${event.name})`;
}
