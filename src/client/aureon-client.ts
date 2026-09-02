/**
 * @fileoverview AureonClient: primary entry point for @buildaureon/sdk.
 *
 * Typed HTTP client for the hosted AUREON API. Operator-issued API keys
 * (`X-Aureon-Api-Key`) identify the bound wallet for control-plane calls;
 * optional wallet Bearer sessions also work (Bearer wins when both are sent).
 * Env bootstrap keys unlock product access only.
 *
 * Objectives default to Automatic automation mode. Vault deposit and withdraw
 * are prepare-calldata steps for wallet signing; not server-side broadcasts.
 * Restorative execution receipts may use `settlement: "vault"` or
 * `settlement: "staged"` depending on the restore path.
 */

import { resolveFetch, userAgentHeader } from "../adapters/fetch-adapter.js";
import {
  DEFAULT_API_BASE_URL,
  SDK_VERSION,
} from "../constants/defaults.js";
import {
  ENDPOINTS,
  developerApiKeyPath,
  objectivePath,
  objectivePausePath,
  objectiveResumePath,
  objectiveRestorePath,
  objectiveRestorePlanPath,
  registryObjectivePath,
  registryPreparePath,
  registryConfirmPath,
  executionSettlementPath,
  executionConfirmSettlementPath,
} from "../constants/endpoints.js";
import { AureonValidationError } from "../errors/base.js";
import {
  buildAllocationComparison,
  detectPlanParadox,
  type AllocationComparisonRow,
  type PlanParadoxResult,
} from "../formatting/allocation.js";
import {
  buildDriftRestoreFlow,
  buildDriftRestoreFlowFromSnapshot,
  type DriftRestoreFlow,
} from "../formatting/drift-restore.js";
import {
  buildReceiptVerificationFlow,
  type ReceiptVerificationFlow,
} from "../formatting/receipt-verification.js";
import {
  buildPortfolioWatchFlow,
  buildPortfolioWatchFlowFromSnapshot,
  DEFAULT_PORTFOLIO_WATCH_BRIEF,
  type AgentHost,
  type PortfolioWatchFlow,
} from "../formatting/portfolio-watch.js";
import {
  buildFullAureonLoopFlow,
  buildFullAureonLoopFlowFromSnapshot,
  DEFAULT_FULL_LOOP_BRIEF,
  type FullAureonLoopFlow,
} from "../formatting/full-aureon-loop.js";
import {
  buildFinancialAuditTrail,
  type FinancialAuditTrail,
} from "../formatting/audit-trail.js";
import {
  buildObjectivePortfolioFlow,
  resolveObjectiveFromIntent,
  type FinancialIntent,
  type ObjectivePortfolioFlow,
} from "../formatting/intent.js";
import {
  assertBaseUrl,
  requestJson,
  withQuery,
  type TransportOptions,
} from "../transport/index.js";
import type { AureonClientOptions } from "../types/client-options.js";
import {
  resolveHeaders,
  resolveMaxRetries,
  resolveRetryDelayMs,
  resolveTimeoutMs,
} from "../types/client-options.js";
import type { ExecutionReceipt, RestorePlan } from "../types/execution.js";
import {
  findTimelineEventsForReceipt,
  sortExecutionsNewestFirst,
} from "../types/execution.js";
import type {
  ExecutionSettlementLookup,
  SettlementRecord,
} from "../types/settlement.js";
import type {
  ObjectiveRegistryLookup,
  ObjectiveRegistryRecord,
  PrepareRegistryResult,
  RegistryStatus,
} from "../types/registry.js";
import type { ObjectiveHealth } from "../types/health.js";
import type {
  ApplyMarketEventInput,
  DashboardOverview,
  MarketEvent,
  MarketPreset,
} from "../types/market.js";
import type {
  CreateObjectiveInput,
  Objective,
  UpdateObjectiveInput,
} from "../types/objective.js";
import type { PortfolioPositionInput, PortfolioSnapshot } from "../types/portfolio.js";
import type {
  VaultDepositSymbol,
  VaultOverview,
  VaultPrepareResult,
  VaultStatus,
} from "../types/vault.js";
import type { WatchdogRefreshResult } from "../types/watchdog.js";
import type { TimelineEvent } from "../types/timeline.js";
import { normalizeApplyMarketEventInput } from "../validation/market-input.js";
import {
  assertId,
  normalizeCreateObjectiveInput,
  normalizeUpdateObjectiveInput,
} from "../validation/objective-input.js";
import { validateExecutionReceipt } from "../validation/receipt-validator.js";

/** Shared capital book for Update 2/3/4 content-arc demos (~20% stables). */
const DEMO_DRIFT_RESTORE_POSITIONS: PortfolioPositionInput[] = [
  {
    symbol: "USDG",
    name: "Paxos USDG",
    category: "stable",
    quantity: 24_000,
    markPriceUsd: 1,
  },
  {
    symbol: "NVDA",
    name: "NVIDIA Stock Token",
    category: "stock_token",
    quantity: 45,
    markPriceUsd: 920,
  },
  {
    symbol: "AAPL",
    name: "Apple Stock Token",
    category: "stock_token",
    quantity: 80,
    markPriceUsd: 210,
  },
  {
    symbol: "ETH",
    name: "Ether",
    category: "gas",
    quantity: 8.5,
    markPriceUsd: 3400,
  },
];

export interface AuthNonceResponse {
  walletAddress: string;
  nonce: string;
  message: string;
  expiresAt: string;
}

export interface AuthSessionResponse {
  token: string;
  walletAddress: string;
  expiresAt: string;
  sessionId: string;
  mode?: string;
}

export interface AuthMeResponse {
  walletAddress: string;
}

export interface SyncPortfolioResult {
  portfolio: PortfolioSnapshot;
  chainId: number;
  skippedZero: string[];
}

export interface DeveloperApiKey {
  id: string;
  name: string;
  prefix: string;
  status: string;
  createdAt: string;
  revokedAt: string | null;
}

export interface CreatedDeveloperApiKey extends DeveloperApiKey {
  /** Plaintext secret; only returned once at creation. */
  secret: string;
}

/**
 * High-level SDK client for AUREON operator and developer integrations.
 */
export class AureonClient {
  private readonly transport: TransportOptions;

  constructor(options: AureonClientOptions = {}) {
    const baseUrl = options.baseUrl ?? DEFAULT_API_BASE_URL;

    const staticToken = options.authToken;
    const getAccessToken =
      options.getAccessToken ??
      (staticToken
        ? () => staticToken
        : undefined);

    const staticApiKey = options.apiKey;
    const getApiKey =
      options.getApiKey ??
      (staticApiKey
        ? () => staticApiKey
        : undefined);

    this.transport = {
      baseUrl: assertBaseUrl(baseUrl),
      fetchImpl: resolveFetch(options.fetch),
      headers: {
        ...userAgentHeader(SDK_VERSION),
        ...resolveHeaders({ ...options, apiKey: undefined }),
      },
      timeoutMs: resolveTimeoutMs(options),
      maxRetries: resolveMaxRetries(options),
      retryDelayMs: resolveRetryDelayMs(options),
      logger: options.logger,
      getAccessToken,
      getApiKey,
    };
  }

  /** Returns the resolved API base URL. */
  get baseUrl(): string {
    return this.transport.baseUrl;
  }

  /** Health probe for connectivity checks. No auth required. */
  async ping(): Promise<{ ok: true; service: string; version: string }> {
    return requestJson(this.transport, ENDPOINTS.healthz);
  }

  /**
   * Requests a single-use wallet auth nonce/message for the given address.
   * No Bearer token required.
   */
  async getAuthNonce(address: string): Promise<AuthNonceResponse> {
    const trimmed = address?.trim();
    if (!trimmed) {
      throw new AureonValidationError("address is required");
    }
    return requestJson(
      this.transport,
      withQuery(ENDPOINTS.authNonce, { address: trimmed })
    );
  }

  /**
   * Verifies a wallet signature and returns a Bearer session.
   * No Bearer token required on the request itself.
   */
  async verifyWallet(input: {
    address: string;
    message: string;
    signature: string;
    inviteCode?: string;
  }): Promise<AuthSessionResponse> {
    const address = input.address?.trim();
    const message = input.message?.trim();
    const signature = input.signature?.trim();
    const inviteCode = input.inviteCode?.trim();
    if (!address || !message || !signature) {
      throw new AureonValidationError(
        "address, message, and signature are required"
      );
    }
    return requestJson(this.transport, ENDPOINTS.authVerify, {
      method: "POST",
      body: { address, message, signature, inviteCode },
    });
  }

  /**
   * Local preview login without a wallet signature.
   * Only succeeds when the backend has `AUREON_ALLOW_DEV_LOGIN=1`.
   */
  async devLogin(): Promise<AuthSessionResponse> {
    return requestJson(this.transport, ENDPOINTS.authDevLogin, {
      method: "POST",
    });
  }

  /** Revokes the current Bearer session on the server. */
  async logout(): Promise<{ ok: true }> {
    return requestJson(this.transport, ENDPOINTS.authLogout, {
      method: "POST",
    });
  }

  /** Returns the wallet bound to the current Bearer session. Auth required. */
  async me(): Promise<AuthMeResponse> {
    return requestJson(this.transport, ENDPOINTS.authMe);
  }

  /**
   * Creates and activates a Financial Compass Objective (FCO).
   * SDK / agent path always prefers Automatic (`automationMode` omitted → `"auto"`).
   * Mode cannot be changed later via `updateObjective`; recreate instead.
   * Passing `"manual"` is reserved for the operator utility Approve UX.
   * Auth required.
   */
  async createObjective(input: CreateObjectiveInput): Promise<Objective> {
    const body = normalizeCreateObjectiveInput(input);
    return requestJson(this.transport, ENDPOINTS.objectives, {
      method: "POST",
      body,
    });
  }

  /** Lists objectives for the authenticated wallet. Auth required. */
  async listObjectives(): Promise<Objective[]> {
    const result = await requestJson<{ objectives: Objective[] }>(
      this.transport,
      ENDPOINTS.objectives
    );
    return result.objectives;
  }

  /** Fetches a single objective by id. Auth required. */
  async getObjective(id: string): Promise<Objective> {
    assertId(id, "objective id");
    return requestJson(this.transport, objectivePath(id));
  }

  /**
   * Applies a partial update to an objective policy or metadata.
   * Does **not** accept `automationMode` or `targetSymbol` (both locked at create).
   * Auth required.
   */
  async updateObjective(
    id: string,
    input: UpdateObjectiveInput
  ): Promise<Objective> {
    assertId(id, "objective id");
    const body = normalizeUpdateObjectiveInput(input);
    return requestJson(this.transport, objectivePath(id), {
      method: "PATCH",
      body,
    });
  }

  /** Pauses continuous evaluation for an objective. Auth required. */
  async pauseObjective(id: string): Promise<Objective> {
    assertId(id, "objective id");
    return requestJson(this.transport, objectivePausePath(id), {
      method: "POST",
    });
  }

  /** Resumes evaluation for a paused objective. Auth required. */
  async resumeObjective(id: string): Promise<Objective> {
    assertId(id, "objective id");
    return requestJson(this.transport, objectiveResumePath(id), {
      method: "POST",
    });
  }

  /** Returns health for one objective or all objectives when id is omitted. Auth required. */
  async getHealth(objectiveId?: string): Promise<ObjectiveHealth[]> {
    const path = withQuery(ENDPOINTS.health, { objectiveId });
    const result = await requestJson<{ health: ObjectiveHealth[] }>(
      this.transport,
      path
    );
    return result.health;
  }

  /** Returns timeline events, optionally filtered by objective. Auth required. */
  async getTimeline(objectiveId?: string): Promise<TimelineEvent[]> {
    const path = withQuery(ENDPOINTS.timeline, { objectiveId });
    const result = await requestJson<{ events: TimelineEvent[] }>(
      this.transport,
      path
    );
    return result.events;
  }

  /** Returns the current portfolio snapshot for the wallet. Auth required. */
  async getPortfolio(): Promise<PortfolioSnapshot> {
    return requestJson(this.transport, ENDPOINTS.portfolio);
  }

  /**
   * Replaces the wallet capital book with the provided positions.
   * Auth required. Does not invent holdings: every row must be supplied.
   */
  async setPortfolio(
    positions: PortfolioPositionInput[]
  ): Promise<PortfolioSnapshot> {
    if (!Array.isArray(positions) || positions.length === 0) {
      throw new AureonValidationError("positions must be a non-empty array");
    }
    const result = await requestJson<{ portfolio: PortfolioSnapshot }>(
      this.transport,
      ENDPOINTS.portfolio,
      { method: "PUT", body: { positions } }
    );
    return result.portfolio;
  }

  /**
   * Clears all capital-book positions for the authenticated wallet.
   * Auth required. Does not invent seeded holdings.
   */
  async clearPortfolio(): Promise<PortfolioSnapshot> {
    const result = await requestJson<{ portfolio: PortfolioSnapshot }>(
      this.transport,
      ENDPOINTS.portfolioClear,
      { method: "POST" }
    );
    return result.portfolio;
  }

  /**
   * Replaces the capital book with on-chain balances for the session wallet
   * (Robinhood Chain via the AUREON API). Vault balances merge into the book.
   * Requires a wallet Bearer session; SDK clients should also send an API key
   * when keys are enforced. Does not invent holdings; only positive balances
   * returned by the API.
   */
  async syncPortfolio(): Promise<SyncPortfolioResult> {
    return requestJson(this.transport, ENDPOINTS.portfolioSync, {
      method: "POST",
    });
  }

  /**
   * Refreshes portfolio marks from live public market data, re-evaluates
   * objectives, optionally fires breach webhooks, and returns restore suggestions.
   * Auth required.
   */
  async refreshWatchdog(): Promise<WatchdogRefreshResult> {
    return requestJson(this.transport, ENDPOINTS.watchdogRefresh, {
      method: "POST",
    });
  }

  /** Returns dashboard overview aggregates. Auth required. */
  async getOverview(): Promise<DashboardOverview> {
    return requestJson(this.transport, ENDPOINTS.overview);
  }

  /**
   * Objective vs actual portfolio — joins objectives, health, and overview
   * into comparison rows plus a green-book/off-plan paradox flag.
   * Auth required.
   */
  async getAllocationVsTarget(): Promise<{
    rows: AllocationComparisonRow[];
    paradox: PlanParadoxResult;
    overview: DashboardOverview;
  }> {
    const [overview, objectives, health] = await Promise.all([
      this.getOverview(),
      this.listObjectives(),
      this.getHealth(),
    ]);
    const rows = buildAllocationComparison(objectives, health);
    const paradox = detectPlanParadox(overview, health);
    return { rows, paradox, overview };
  }

  /**
   * Registers agent/user intent as an Automatic objective and returns the
   * AI → objective → portfolio flow snapshot.
   * Auth required.
   */
  async applyFinancialIntent(
    intent: FinancialIntent
  ): Promise<ObjectivePortfolioFlow> {
    const objective = await this.createObjective(
      resolveObjectiveFromIntent(intent)
    );
    try {
      await this.refreshWatchdog();
    } catch {
      // Watchdog may be unavailable in some environments; health still loads below.
    }
    const [healthRecords, portfolio] = await Promise.all([
      this.getHealth(objective.id),
      this.getPortfolio(),
    ]);
    return buildObjectivePortfolioFlow(
      intent,
      objective,
      healthRecords[0] ?? null,
      portfolio
    );
  }

  /**
   * Read-only AI → objective → portfolio flow for existing objectives.
   * Auth required.
   */
  async getObjectivePortfolioFlow(
    objectiveId?: string
  ): Promise<ObjectivePortfolioFlow[]> {
    const [objectives, healthRecords, portfolio] = await Promise.all([
      objectiveId
        ? [await this.getObjective(objectiveId)]
        : this.listObjectives(),
      this.getHealth(objectiveId),
      this.getPortfolio(),
    ]);

    const active = objectives.filter(
      (o) => o.status === "active" || o.status === "validated"
    );
    const healthById = new Map(healthRecords.map((h) => [h.objectiveId, h]));

    return active.map((objective) => {
      const health = healthById.get(objective.id) ?? null;
      const intent: FinancialIntent = {
        brief: objective.name,
        kind: objective.kind,
        targetWeight: objective.policy?.targetWeight ?? 0,
        tolerance: objective.policy?.tolerance ?? 0.02,
        targetSymbol: objective.policy?.targetSymbol,
        name: objective.name,
        priority: objective.priority,
      };
      return buildObjectivePortfolioFlow(
        intent,
        objective,
        health,
        portfolio
      );
    });
  }

  /**
   * Controlled drift → detection → restore demo (Update 4).
   * Seeds book, creates stable objective, applies NVDA rally with auto-restore
   * disabled, then runs manual restore and returns the three-beat flow.
   * Auth required.
   */
  async runDriftRestoreDemo(): Promise<DriftRestoreFlow> {
    await this.setPortfolio(DEMO_DRIFT_RESTORE_POSITIONS);

    const objective = await this.createObjective({
      name: "Maintain 20% Stable Assets",
      kind: "stable_allocation",
      targetWeight: 0.2,
      tolerance: 0.02,
    });

    try {
      await this.refreshWatchdog();
    } catch {
      // Watchdog may be unavailable; baseline health still loads below.
    }

    const [alignedHealthRecords, baselineRows] = await Promise.all([
      this.getHealth(objective.id),
      this.getAllocationVsTarget(),
    ]);
    const alignedHealth = alignedHealthRecords[0];
    if (!alignedHealth) {
      throw new AureonValidationError(
        "Baseline health missing after objective create"
      );
    }
    const alignedRow = baselineRows.rows.find(
      (r) => r.objectiveId === objective.id
    );

    await this.applyMarketEvent({
      name: "NVDA Stock Token Rally",
      description: "Controlled mark move — Update 4 drift demo",
      symbol: "NVDA",
      priceChangeRatio: 0.45,
      autoRestore: false,
    });

    const [driftHealthRecords, driftRows, restorePlan] = await Promise.all([
      this.getHealth(objective.id),
      this.getAllocationVsTarget(),
      this.getRestorePlan(objective.id),
    ]);
    const driftHealth = driftHealthRecords[0];
    if (!driftHealth) {
      throw new AureonValidationError("Drift health missing after market event");
    }
    const driftRow = driftRows.rows.find((r) => r.objectiveId === objective.id);

    const receipt = await this.restoreObjective(objective.id);

    const [restoredHealthRecords] = await Promise.all([
      this.getHealth(objective.id),
    ]);
    const restoredHealth = restoredHealthRecords[0];

    return buildDriftRestoreFlow({
      objective,
      alignedHealth,
      driftHealth,
      driftPlan: restorePlan,
      restoredHealth: restoredHealth ?? driftHealth,
      receipt,
      alignedRow,
      driftRow,
    });
  }

  /**
   * Read-only drift → detection → restore flow for active objectives.
   * Auth required.
   */
  async getDriftRestoreFlow(objectiveId?: string): Promise<DriftRestoreFlow[]> {
    const [objectives, healthRecords, allocation, executions] = await Promise.all([
      objectiveId
        ? [await this.getObjective(objectiveId)]
        : this.listObjectives(),
      this.getHealth(objectiveId),
      this.getAllocationVsTarget(),
      this.listExecutions(objectiveId),
    ]);

    const active = objectives.filter(
      (o) => o.status === "active" || o.status === "validated"
    );
    const healthById = new Map(healthRecords.map((h) => [h.objectiveId, h]));
    const rowById = new Map(
      allocation.rows.map((r) => [r.objectiveId, r])
    );
    const receiptsByObjective = new Map<string, ExecutionReceipt>();
    for (const receipt of sortExecutionsNewestFirst(executions)) {
      if (!receiptsByObjective.has(receipt.objectiveId)) {
        receiptsByObjective.set(receipt.objectiveId, receipt);
      }
    }

    const flows: DriftRestoreFlow[] = [];
    for (const objective of active) {
      const health = healthById.get(objective.id);
      if (!health) continue;

      let restorePlan: RestorePlan | undefined;
      if (health.state === "warning" || health.state === "violation") {
        try {
          restorePlan = await this.getRestorePlan(objective.id);
        } catch {
          // Plan unavailable when restore path is blocked.
        }
      }

      flows.push(
        buildDriftRestoreFlowFromSnapshot({
          objective,
          health,
          allocationRow: rowById.get(objective.id),
          restorePlan,
          latestReceipt: receiptsByObjective.get(objective.id),
        })
      );
    }

    return flows;
  }

  private async buildReceiptVerificationFlowForReceipt(
    receipt: ExecutionReceipt,
    timelineEvents?: TimelineEvent[]
  ): Promise<ReceiptVerificationFlow> {
    const validation = validateExecutionReceipt(receipt);

    let settlement: ExecutionSettlementLookup | undefined;
    if (receipt.settlement === "vault") {
      try {
        settlement = await this.getExecutionSettlement(receipt.id);
      } catch {
        // Settlement lookup unavailable — flow still reports validation tier.
      }
    }

    const events =
      timelineEvents ??
      findTimelineEventsForReceipt(
        await this.getTimeline(receipt.objectiveId),
        receipt
      );

    return buildReceiptVerificationFlow({
      receipt,
      validation,
      settlement,
      timelineEvents: events,
    });
  }

  /**
   * Controlled receipt → verification demo (Update 5).
   * Runs drift-restore (Update 4), then validates receipt and looks up settlement.
   * Auth required.
   */
  async runReceiptVerificationDemo(): Promise<ReceiptVerificationFlow> {
    const driftFlow = await this.runDriftRestoreDemo();
    const receipt = driftFlow.phases.restored?.receipt;
    if (!receipt) {
      throw new AureonValidationError(
        "Restore receipt missing after drift-restore demo"
      );
    }
    return this.buildReceiptVerificationFlowForReceipt(receipt);
  }

  /**
   * Read-only receipt → verification flow for execution receipts.
   * Auth required.
   */
  async getReceiptVerificationFlow(
    executionId?: string
  ): Promise<ReceiptVerificationFlow[]> {
    const executions = sortExecutionsNewestFirst(await this.listExecutions());
    const targets = executionId
      ? executions.filter((e) => e.id === executionId)
      : executions.slice(0, 5);

    if (targets.length === 0) {
      return [];
    }

    const timeline = await this.getTimeline();
    const flows: ReceiptVerificationFlow[] = [];
    for (const receipt of targets) {
      flows.push(
        await this.buildReceiptVerificationFlowForReceipt(
          receipt,
          findTimelineEventsForReceipt(timeline, receipt)
        )
      );
    }
    return flows;
  }

  /**
   * Controlled portfolio watch demo (Update 6).
   * User brief → Automatic objective → market move while away → auto restore → return briefing.
   * Auth required.
   */
  async runPortfolioWatchDemo(input?: {
    brief?: string;
    host?: AgentHost;
  }): Promise<PortfolioWatchFlow> {
    const userBrief = input?.brief?.trim() || DEFAULT_PORTFOLIO_WATCH_BRIEF;
    const host = input?.host ?? "cursor";

    await this.setPortfolio(DEMO_DRIFT_RESTORE_POSITIONS);

    const intent: FinancialIntent = {
      brief: userBrief,
      kind: "stable_allocation",
      targetWeight: 0.2,
      tolerance: 0.02,
    };

    const setup = await this.applyFinancialIntent(intent);
    const objective = setup.objective;
    const registerHealth = setup.health;
    if (!registerHealth) {
      throw new AureonValidationError(
        "Register health missing after applyFinancialIntent"
      );
    }

    const baselineRows = await this.getAllocationVsTarget();
    const registerRow = baselineRows.rows.find(
      (r) => r.objectiveId === objective.id
    );

    const healthBeforeRecords = await this.getHealth(objective.id);
    const healthBefore = healthBeforeRecords[0];
    if (!healthBefore) {
      throw new AureonValidationError("Baseline health missing before market event");
    }

    const marketResult = await this.applyMarketEvent({
      name: "NVDA rally while you were away",
      description: "Update 6 portfolio watch demo — auto restore on",
      symbol: "NVDA",
      priceChangeRatio: 0.45,
      autoRestore: true,
    });

    const healthAfter =
      marketResult.health.find((h) => h.objectiveId === objective.id) ??
      healthBefore;
    const receipt = marketResult.executions.find(
      (e) => e.objectiveId === objective.id
    );

    const timeline = await this.getTimeline(objective.id);

    return buildPortfolioWatchFlow({
      userBrief,
      host,
      objective,
      registerHealth,
      registerRow,
      whileAway: {
        marketEvent: marketResult.event,
        healthBefore,
        healthAfter,
        autoRestored: marketResult.executions.length > 0,
        receipt,
      },
      briefingHealth: healthAfter,
      timelineEvents: timeline.slice(0, 10),
    });
  }

  /**
   * Read-only portfolio watch briefing for Automatic objectives.
   * Auth required.
   */
  async getPortfolioWatchFlow(input?: {
    objectiveId?: string;
    brief?: string;
    host?: AgentHost;
  }): Promise<PortfolioWatchFlow[]> {
    const userBrief =
      input?.brief?.trim() || DEFAULT_PORTFOLIO_WATCH_BRIEF;
    const host = input?.host ?? "mcp";

    const [objectives, healthRecords, allocation, timeline] =
      await Promise.all([
        input?.objectiveId
          ? [await this.getObjective(input.objectiveId)]
          : this.listObjectives(),
        this.getHealth(input?.objectiveId),
        this.getAllocationVsTarget(),
        this.getTimeline(input?.objectiveId),
      ]);

    const active = objectives.filter(
      (o) =>
        (o.status === "active" || o.status === "validated") &&
        (o.automationMode ?? "auto") === "auto"
    );
    const healthById = new Map(healthRecords.map((h) => [h.objectiveId, h]));
    const rowById = new Map(allocation.rows.map((r) => [r.objectiveId, r]));

    const flows: PortfolioWatchFlow[] = [];
    for (const objective of active) {
      const health = healthById.get(objective.id);
      if (!health) continue;

      const objectiveTimeline = timeline.filter(
        (e) => !e.objectiveId || e.objectiveId === objective.id
      );

      flows.push(
        buildPortfolioWatchFlowFromSnapshot({
          userBrief,
          host,
          objective,
          health,
          allocationRow: rowById.get(objective.id),
          timelineEvents: objectiveTimeline.slice(0, 10),
        })
      );
    }

    return flows;
  }

  /**
   * Controlled full AUREON loop demo (Content Arc Update 7).
   * Intent → plan check (green vs plan with autoRestore false) → restore → receipt verification.
   * Auth required.
   */
  async runFullAureonLoopDemo(input?: {
    brief?: string;
  }): Promise<FullAureonLoopFlow> {
    const userBrief = input?.brief?.trim() || DEFAULT_FULL_LOOP_BRIEF;

    await this.setPortfolio(DEMO_DRIFT_RESTORE_POSITIONS);

    const intent: FinancialIntent = {
      brief: userBrief,
      kind: "stable_allocation",
      targetWeight: 0.2,
      tolerance: 0.02,
    };

    const setup = await this.applyFinancialIntent(intent);
    const objective = setup.objective;
    const baselineHealth = setup.health;
    if (!baselineHealth) {
      throw new AureonValidationError(
        "Baseline health missing after applyFinancialIntent"
      );
    }

    await this.applyMarketEvent({
      name: "NVDA rally — green book, off-plan sleeve",
      description: "Update 7 full loop — autoRestore false to expose plan paradox",
      symbol: "NVDA",
      priceChangeRatio: 0.45,
      autoRestore: false,
    });

    const [afterShockHealthRecords, allocation] = await Promise.all([
      this.getHealth(objective.id),
      this.getAllocationVsTarget(),
    ]);
    const afterShockHealth = afterShockHealthRecords[0];
    if (!afterShockHealth) {
      throw new AureonValidationError("Health missing after market event");
    }
    const afterShockRow = allocation.rows.find(
      (r) => r.objectiveId === objective.id
    );

    const receipt = await this.restoreObjective(objective.id);

    const restoredHealthRecords = await this.getHealth(objective.id);
    const restoredHealth = restoredHealthRecords[0] ?? afterShockHealth;

    const verification =
      await this.buildReceiptVerificationFlowForReceipt(receipt);

    return buildFullAureonLoopFlow({
      userBrief,
      objective,
      baselineHealth,
      afterShockHealth,
      afterShockRow,
      paradox: allocation.paradox,
      restoredHealth,
      receipt,
      verification,
    });
  }

  /**
   * Read-only full AUREON loop for active objectives with a latest receipt.
   * Auth required.
   */
  async getFullAureonLoopFlow(input?: {
    objectiveId?: string;
    brief?: string;
  }): Promise<FullAureonLoopFlow[]> {
    const userBrief = input?.brief?.trim() || DEFAULT_FULL_LOOP_BRIEF;

    const [objectives, healthRecords, allocation, executions] =
      await Promise.all([
        input?.objectiveId
          ? [await this.getObjective(input.objectiveId)]
          : this.listObjectives(),
        this.getHealth(input?.objectiveId),
        this.getAllocationVsTarget(),
        this.listExecutions(input?.objectiveId),
      ]);

    const active = objectives.filter(
      (o) => o.status === "active" || o.status === "validated"
    );
    const healthById = new Map(healthRecords.map((h) => [h.objectiveId, h]));
    const rowById = new Map(allocation.rows.map((r) => [r.objectiveId, r]));
    const receiptsByObjective = new Map<string, ExecutionReceipt>();
    for (const receipt of sortExecutionsNewestFirst(executions)) {
      if (!receiptsByObjective.has(receipt.objectiveId)) {
        receiptsByObjective.set(receipt.objectiveId, receipt);
      }
    }

    const flows: FullAureonLoopFlow[] = [];
    for (const objective of active) {
      const health = healthById.get(objective.id);
      if (!health) continue;
      const latestReceipt = receiptsByObjective.get(objective.id);
      if (!latestReceipt) continue;

      const verification =
        await this.buildReceiptVerificationFlowForReceipt(latestReceipt);

      const flow = buildFullAureonLoopFlowFromSnapshot({
        userBrief,
        objective,
        health,
        allocationRow: rowById.get(objective.id),
        paradox: allocation.paradox,
        latestReceipt,
        verification,
      });
      if (flow) flows.push(flow);
    }

    return flows;
  }

  /**
   * Applies a controlled market event to portfolio marks.
   * When autoRestore is true, the API evaluates health and may run staged restorative execution.
   * Auth required.
   */
  async applyMarketEvent(input: ApplyMarketEventInput): Promise<{
    event: MarketEvent;
    portfolio: PortfolioSnapshot;
    health: ObjectiveHealth[];
    executions: ExecutionReceipt[];
  }> {
    const body = normalizeApplyMarketEventInput(input);
    return requestJson(this.transport, ENDPOINTS.marketEvents, {
      method: "POST",
      body,
    });
  }

  /** Lists controlled market event presets. Auth required. */
  async listMarketPresets(): Promise<MarketPreset[]> {
    const result = await requestJson<{ presets: MarketPreset[] }>(
      this.transport,
      ENDPOINTS.marketPresets
    );
    return result.presets;
  }

  /**
   * Returns the restore plan for an objective (wrap ETH, unwrap WETH, or vault swap).
   * Auth required.
   */
  async getRestorePlan(objectiveId: string): Promise<RestorePlan> {
    assertId(objectiveId, "objective id");
    const result = await requestJson<{ plan: RestorePlan }>(
      this.transport,
      objectiveRestorePlanPath(objectiveId)
    );
    return result.plan;
  }

  /**
   * Runs restorative execution for an objective currently outside policy.
   * Vault Sell A→Buy B when configured. ETH↔WETH wrap/unwrap is client-side
   * via getRestorePlan; this endpoint rejects those with action details.
   * Auth required.
   */
  async runExecution(objectiveId: string): Promise<ExecutionReceipt> {
    assertId(objectiveId, "objective id");
    return requestJson(this.transport, ENDPOINTS.executionsRun, {
      method: "POST",
      body: { objectiveId },
    });
  }

  /**
   * Runs vault-backed restorative execution for an objective outside policy.
   * Auth required.
   */
  async restoreObjective(objectiveId: string): Promise<ExecutionReceipt> {
    assertId(objectiveId, "objective id");
    return requestJson(this.transport, objectiveRestorePath(objectiveId), {
      method: "POST",
    });
  }

  /** Lists recent execution receipts. Auth required. */
  async listExecutions(objectiveId?: string): Promise<ExecutionReceipt[]> {
    const path = withQuery(ENDPOINTS.executions, { objectiveId });
    const result = await requestJson<{ executions: ExecutionReceipt[] }>(
      this.transport,
      path
    );
    return result.executions;
  }

  /** Returns chain-verified settlement record for an execution when present. Auth required. */
  async getExecutionSettlement(executionId: string): Promise<ExecutionSettlementLookup> {
    assertId(executionId, "execution id");
    return requestJson(this.transport, executionSettlementPath(executionId));
  }

  /** Lists chain-verified settlement records for the authenticated wallet. Auth required. */
  async listSettlements(objectiveId?: string): Promise<SettlementRecord[]> {
    const path = withQuery(ENDPOINTS.settlements, { objectiveId });
    const result = await requestJson<{ settlements: SettlementRecord[] }>(
      this.transport,
      path
    );
    return result.settlements;
  }

  /**
   * Manual backfill: verify a vault tx on-chain and attach settlement proof.
   * Auth required.
   */
  async confirmExecutionSettlement(
    executionId: string,
    transactionHash: string
  ): Promise<{ settlement: SettlementRecord }> {
    assertId(executionId, "execution id");
    const hash = transactionHash.trim();
    if (!hash) {
      throw new AureonValidationError("transactionHash is required");
    }
    return requestJson(this.transport, executionConfirmSettlementPath(executionId), {
      method: "POST",
      body: { transactionHash: hash },
    });
  }

  /** Returns Phase 2 ObjectiveRegistry deployment status. Auth required. */
  async getRegistryStatus(): Promise<RegistryStatus> {
    return requestJson(this.transport, ENDPOINTS.registryStatus);
  }

  /** Returns on-chain registry record for an objective when registered. Auth required. */
  async getObjectiveRegistry(objectiveId: string): Promise<ObjectiveRegistryLookup> {
    assertId(objectiveId, "objective id");
    return requestJson(this.transport, registryObjectivePath(objectiveId));
  }

  /**
   * Prepares wallet-signed calldata to register an objective on ObjectiveRegistry.
   * Auth required.
   */
  async prepareObjectiveRegistry(objectiveId: string): Promise<PrepareRegistryResult> {
    assertId(objectiveId, "objective id");
    return requestJson(this.transport, registryPreparePath(objectiveId), {
      method: "POST",
    });
  }

  /**
   * Confirms an on-chain registration after the wallet broadcast tx.
   * Auth required.
   */
  async confirmObjectiveRegistry(
    objectiveId: string,
    transactionHash: string
  ): Promise<{ record: ObjectiveRegistryRecord }> {
    assertId(objectiveId, "objective id");
    const hash = transactionHash.trim();
    if (!hash) {
      throw new AureonValidationError("transactionHash is required");
    }
    return requestJson(this.transport, registryConfirmPath(objectiveId), {
      method: "POST",
      body: { transactionHash: hash },
    });
  }

  /** Returns the vault overview for the authenticated wallet. Auth required. */
  async getVault(): Promise<VaultOverview> {
    return requestJson(this.transport, ENDPOINTS.vault);
  }

  /** Returns compact vault funding status before restore. Auth required. */
  async getVaultStatus(): Promise<VaultStatus> {
    return requestJson(this.transport, ENDPOINTS.vaultStatus);
  }

  /**
   * Prepares wallet-signed calldata steps for a vault deposit.
   * Auth required.
   */
  async prepareVaultDeposit(input: {
    symbol: VaultDepositSymbol;
    amount: string;
  }): Promise<VaultPrepareResult> {
    const symbol = input.symbol?.trim();
    const amount = input.amount?.trim();
    if (!symbol) {
      throw new AureonValidationError(
        "symbol is required (ETH or an allowlisted ERC-20)"
      );
    }
    if (!amount) {
      throw new AureonValidationError("amount is required");
    }
    return requestJson(this.transport, ENDPOINTS.vaultPrepareDeposit, {
      method: "POST",
      body: { symbol: symbol.toUpperCase(), amount },
    });
  }

  /**
   * Prepares wallet-signed calldata steps for a vault withdraw (any allowlisted ERC-20).
   * Auth required.
   */
  async prepareVaultWithdraw(input: {
    symbol?: string;
    amount: string;
  }): Promise<VaultPrepareResult> {
    const symbol = (input.symbol?.trim() || "WETH").toUpperCase();
    const amount = input.amount?.trim();
    if (!amount) {
      throw new AureonValidationError("amount is required");
    }
    if (symbol === "ETH") {
      throw new AureonValidationError(
        'withdraw symbol cannot be "ETH", use WETH'
      );
    }
    return requestJson(this.transport, ENDPOINTS.vaultPrepareWithdraw, {
      method: "POST",
      body: { symbol, amount },
    });
  }

  /**
   * Lists SDK API keys for the authenticated wallet.
   * Used by the operator utility Developer page.
   */
  async listApiKeys(): Promise<DeveloperApiKey[]> {
    const result = await requestJson<{ keys: DeveloperApiKey[] }>(
      this.transport,
      ENDPOINTS.developerApiKeys
    );
    return result.keys;
  }

  /**
   * Creates an SDK API key. `secret` is returned once; store it immediately.
   */
  async createApiKey(name: string): Promise<CreatedDeveloperApiKey> {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      throw new AureonValidationError("name must be at least 2 characters");
    }
    return requestJson(this.transport, ENDPOINTS.developerApiKeys, {
      method: "POST",
      body: { name: trimmed },
    });
  }

  /** Revokes (deletes) an SDK API key owned by this wallet. */
  async revokeApiKey(keyId: string): Promise<DeveloperApiKey> {
    assertId(keyId, "api key id");
    return requestJson(this.transport, developerApiKeyPath(keyId), {
      method: "DELETE",
    });
  }

  /** Toggles the status (active/paused) of an SDK API key owned by this wallet. */
  async toggleApiKey(keyId: string): Promise<DeveloperApiKey> {
    assertId(keyId, "api key id");
    return requestJson(this.transport, `${developerApiKeyPath(keyId)}/toggle`, {
      method: "POST",
    });
  }

  /**
   * Joins objective → registry → receipts → settlements → timeline.
   * Missing proof is labeled as a gap. Nothing is invented. Auth required.
   */
  async getAuditTrail(objectiveId: string): Promise<FinancialAuditTrail> {
    assertId(objectiveId, "objective id");
    const [objective, healthRows, receipts, settlements, timeline] =
      await Promise.all([
        this.getObjective(objectiveId),
        this.getHealth(objectiveId),
        this.listExecutions(objectiveId),
        this.listSettlements(objectiveId).catch(() => [] as SettlementRecord[]),
        this.getTimeline(objectiveId),
      ]);

    let registry: Awaited<ReturnType<typeof this.getObjectiveRegistry>> = {
      registered: false,
      objectiveId,
    };
    try {
      registry = await this.getObjectiveRegistry(objectiveId);
    } catch {
      // Registry lookup optional — trail still exports what exists.
    }

    return buildFinancialAuditTrail({
      objective,
      health: healthRows[0],
      registry,
      receipts: sortExecutionsNewestFirst(receipts),
      settlements,
      timeline,
    });
  }
}
