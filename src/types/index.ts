/**
 * @fileoverview Barrel exports for SDK domain types.
 */

export type {
  Objective,
  ObjectiveKind,
  ObjectivePolicy,
  ObjectivePriority,
  ObjectiveAutomationMode,
  ObjectiveStatus,
  CreateObjectiveInput,
  UpdateObjectiveInput,
} from "./objective.js";
export {
  OBJECTIVE_KINDS,
  OBJECTIVE_PRIORITIES,
  isObjectiveKind,
  isObjectivePriority,
} from "./objective.js";

export type { PortfolioPosition, PortfolioPositionInput, PortfolioSnapshot } from "./portfolio.js";
export {
  assertPortfolioSnapshot,
  findPosition,
  sumNotionalByCategory,
} from "./portfolio.js";

export type { HealthState, ObjectiveHealth } from "./health.js";
export { healthRank, isHealthState, pickWorstHealth } from "./health.js";

export type { TimelineEvent, TimelineEventType } from "./timeline.js";
export {
  TIMELINE_EVENT_TYPES,
  filterTimelineByObjective,
  isTimelineEventType,
} from "./timeline.js";

export type { ExecutionReceipt, RestorePlan, RestorePlanKind } from "./execution.js";
export {
  isConfirmedExecution,
  isVaultSettlement,
  shortTransactionHash,
  sortExecutionsNewestFirst,
} from "./execution.js";

export type {
  VaultBalance,
  VaultDepositSymbol,
  VaultOverview,
  VaultPrepareResult,
  VaultPreparedStep,
  VaultStatus,
  VaultToken,
  VaultWithdrawSymbol,
} from "./vault.js";

export type {
  ApplyMarketEventInput,
  DashboardOverview,
  MarketEvent,
  MarketPreset,
} from "./market.js";
export { describeMarketMove, normalizeSymbol } from "./market.js";

export type { AureonClientOptions } from "./client-options.js";
export type {
  MarkQuote,
  MarkQuoteSource,
  RestoreSuggestion,
  RestoreSuggestionAction,
  WatchdogAlertResult,
  WatchdogRefreshResult,
} from "./watchdog.js";
export {
  DEFAULT_TIMEOUT_MS,
  resolveHeaders,
  resolveMaxRetries,
  resolveRetryDelayMs,
  resolveTimeoutMs,
} from "./client-options.js";
