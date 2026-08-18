/**
 * @fileoverview API path constants for AureonClient methods.
 */

export const ENDPOINTS = {
  healthz: "/healthz",
  overview: "/overview",
  portfolio: "/portfolio",
  portfolioClear: "/portfolio/clear",
  portfolioSync: "/portfolio/sync",
  watchdogRefresh: "/watchdog/refresh",
  objectives: "/objectives",
  health: "/health",
  timeline: "/timeline",
  executions: "/executions",
  executionsRun: "/executions/run",
  marketEvents: "/market/events",
  marketPresets: "/market/presets",
  vault: "/vault",
  vaultStatus: "/vault/status",
  vaultPrepareDeposit: "/vault/prepare-deposit",
  vaultPrepareWithdraw: "/vault/prepare-withdraw",
  authNonce: "/auth/nonce",
  authVerify: "/auth/verify",
  authLogout: "/auth/logout",
  authDevLogin: "/auth/dev-login",
  authMe: "/auth/me",
  developerApiKeys: "/developer/api-keys",
  registryStatus: "/registry/status",
  settlements: "/settlements",
} as const;

export function objectivePath(id: string): string {
  return `${ENDPOINTS.objectives}/${encodeURIComponent(id)}`;
}

export function objectivePausePath(id: string): string {
  return `${objectivePath(id)}/pause`;
}

export function objectiveResumePath(id: string): string {
  return `${objectivePath(id)}/resume`;
}

export function objectiveRestorePlanPath(id: string): string {
  return `${objectivePath(id)}/restore-plan`;
}

export function objectiveRestorePath(id: string): string {
  return `${objectivePath(id)}/restore`;
}

export function developerApiKeyPath(id: string): string {
  return `${ENDPOINTS.developerApiKeys}/${encodeURIComponent(id)}`;
}

export function registryObjectivePath(id: string): string {
  return `/registry/objectives/${encodeURIComponent(id)}`;
}

export function registryPreparePath(id: string): string {
  return `${registryObjectivePath(id)}/prepare-register`;
}

export function registryConfirmPath(id: string): string {
  return `${registryObjectivePath(id)}/confirm`;
}

export function executionSettlementPath(id: string): string {
  return `/executions/${encodeURIComponent(id)}/settlement`;
}

export function executionConfirmSettlementPath(id: string): string {
  return `/executions/${encodeURIComponent(id)}/confirm-settlement`;
}
