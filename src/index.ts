/**
 * @fileoverview Public exports for @aureon/sdk.
 *
 * Import from `@aureon/sdk` in utility apps, scripts, and integrations.
 */

export {
  AureonClient,
  createAureonClient,
  createLocalAureonClient,
  type AuthMeResponse,
  type AuthNonceResponse,
  type AuthSessionResponse,
  type SyncPortfolioResult,
  type DeveloperApiKey,
  type CreatedDeveloperApiKey,
} from "./client/index.js";

export {
  createSessionTokenProvider,
  type SessionTokenProvider,
} from "./auth/index.js";

export {
  AureonConflictError,
  AureonError,
  AureonNetworkError,
  AureonNotFoundError,
  AureonTimeoutError,
  AureonValidationError,
  errorFromHttpStatus,
  isAureonError,
  type AureonErrorCode,
} from "./errors/index.js";

export {
  buildPolicySummary,
  normalizeCreateObjectiveInput,
  normalizeUpdateObjectiveInput,
} from "./validation/index.js";

export {
  formatUsd,
  formatWeight,
  healthTone,
  formatSignedPercent,
  formatIsoTime,
} from "./formatting/index.js";

export type {
  ApplyMarketEventInput,
  AureonClientOptions,
  CreateObjectiveInput,
  DashboardOverview,
  ExecutionReceipt,
  RestorePlan,
  RestorePlanKind,
  HealthState,
  MarketEvent,
  MarketPreset,
  Objective,
  ObjectiveHealth,
  ObjectiveKind,
  ObjectivePolicy,
  ObjectivePriority,
  ObjectiveAutomationMode,
  ObjectiveStatus,
  PortfolioPosition,
  PortfolioPositionInput,
  PortfolioSnapshot,
  RestoreSuggestion,
  RestoreSuggestionAction,
  TimelineEvent,
  TimelineEventType,
  UpdateObjectiveInput,
  WatchdogAlertResult,
  WatchdogRefreshResult,
  MarkQuote,
  MarkQuoteSource,
  VaultBalance,
  VaultDepositSymbol,
  VaultOverview,
  VaultPrepareResult,
  VaultPreparedStep,
  VaultStatus,
  VaultToken,
  VaultWithdrawSymbol,
} from "./types/index.js";

export {
  OBJECTIVE_KINDS,
  OBJECTIVE_PRIORITIES,
  isObjectiveKind,
  isObjectivePriority,
  isHealthState,
  isVaultSettlement,
  pickWorstHealth,
  TIMELINE_EVENT_TYPES,
  isTimelineEventType,
} from "./types/index.js";

export { assertBaseUrl, joinUrl, requestJson, withQuery } from "./transport/index.js";

export {
  DEFAULT_API_BASE_URL,
  LOCAL_API_BASE_URL,
  API_KEY_HEADER,
  DEFAULT_TIMEOUT_MS,
  PRODUCT_NAME,
  PRODUCT_TAGLINE,
  SDK_NAME,
  SDK_VERSION,
  ENDPOINTS,
} from "./constants/index.js";

export {
  createConsoleLogger,
  silentLogger,
  resolveFetch,
} from "./adapters/index.js";
