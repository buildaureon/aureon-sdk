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
} from "../constants/endpoints.js";
import { AureonValidationError } from "../errors/base.js";
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
}
