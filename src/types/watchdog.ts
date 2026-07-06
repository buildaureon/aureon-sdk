/**
 * @fileoverview Watchdog contracts: live marks, breaches, restore suggestions.
 */

import type { ObjectiveHealth } from "./health.js";
import type { PortfolioSnapshot } from "./portfolio.js";

export type MarkQuoteSource = "peg" | "coingecko" | "yahoo" | "unchanged";

export interface MarkQuote {
  symbol: string;
  priceUsd: number;
  source: MarkQuoteSource;
}

export interface RestoreSuggestionAction {
  side: "buy" | "sell";
  symbol: string;
  quantity: number;
  approxUsd: number;
}

export interface RestoreSuggestion {
  objectiveId: string;
  objectiveName: string;
  targetStableWeight: number;
  currentStableWeight: number;
  deltaStableUsd: number;
  actions: RestoreSuggestionAction[];
  note: string;
}

export interface WatchdogAlertResult {
  objectiveId: string;
  sent: boolean;
  reason?: string;
}

export interface WatchdogRefreshResult {
  refreshedAt: string;
  quotes: MarkQuote[];
  skippedSymbols: string[];
  portfolio: PortfolioSnapshot;
  health: ObjectiveHealth[];
  breaches: ObjectiveHealth[];
  suggestions: RestoreSuggestion[];
  alerts: WatchdogAlertResult[];
}
