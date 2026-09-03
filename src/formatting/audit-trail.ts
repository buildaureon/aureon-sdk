/**
 * @fileoverview Financial audit trail — objective → registry → receipt → settlement.
 *
 * Joins what already exists. Never invents missing proof. Gaps stay labeled.
 */

import type { ExecutionReceipt } from "../types/execution.js";
import { formatReceiptSummary } from "../types/execution.js";
import type { ObjectiveHealth } from "../types/health.js";
import type { Objective } from "../types/objective.js";
import type {
  ObjectiveRegistryLookup,
  ObjectiveRegistryRecord,
} from "../types/registry.js";
import type { SettlementRecord } from "../types/settlement.js";
import type { TimelineEvent } from "../types/timeline.js";
import { buildPolicySummary } from "../validation/objective-input.js";
import {
  validateExecutionReceipt,
  type ReceiptValidationResult,
} from "../validation/receipt-validator.js";

export type AuditTrailGapCode =
  | "not_registered"
  | "no_executions"
  | "no_settlements"
  | "staged_only"
  | "vault_unverified"
  | "invalid_receipt"
  | "no_timeline";

export interface AuditTrailGap {
  code: AuditTrailGapCode;
  message: string;
}

export interface AuditTrailReceiptRow {
  id: string;
  action: string;
  settlement: "vault" | "staged";
  status: string;
  valid: boolean;
  verifiedOnChain: boolean;
  explorerUrl: string | null;
  summary: string;
  validation: ReceiptValidationResult;
}

export interface FinancialAuditTrail {
  objectiveId: string;
  objectiveName: string;
  policySummary: string;
  healthState: string | null;
  generatedAt: string;
  registry: {
    present: boolean;
    record?: ObjectiveRegistryRecord;
  };
  receipts: AuditTrailReceiptRow[];
  settlements: SettlementRecord[];
  timeline: Array<{
    id: string;
    type: string;
    message: string;
    createdAt: string;
    executionId: string | null;
  }>;
  gaps: AuditTrailGap[];
  message: string;
}

export function buildFinancialAuditTrail(input: {
  objective: Objective;
  health?: ObjectiveHealth;
  registry?: ObjectiveRegistryLookup;
  receipts: ExecutionReceipt[];
  settlements: SettlementRecord[];
  timeline: TimelineEvent[];
  generatedAt?: string;
}): FinancialAuditTrail {
  const targetWeight = input.objective.policy?.targetWeight ?? 0;
  const tolerance = input.objective.policy?.tolerance ?? 0.02;
  const policySummary =
    input.objective.policy?.summary ??
    buildPolicySummary(input.objective.kind, targetWeight, tolerance);

  const registered =
    input.registry?.registered === true ? input.registry.record : undefined;

  const receipts = input.receipts.map((receipt) => {
    const validation = validateExecutionReceipt(receipt);
    return {
      id: receipt.id,
      action: receipt.action,
      settlement: receipt.settlement,
      status: receipt.status,
      valid: validation.valid,
      verifiedOnChain: receipt.verifiedOnChain === true,
      explorerUrl: receipt.explorerUrl ?? null,
      summary: formatReceiptSummary(receipt),
      validation,
    };
  });

  const timeline = input.timeline.map((event) => ({
    id: event.id,
    type: event.type,
    message: event.message,
    createdAt: event.createdAt,
    executionId:
      typeof event.payload?.executionId === "string"
        ? event.payload.executionId
        : null,
  }));

  const gaps: AuditTrailGap[] = [];
  if (!registered) {
    gaps.push({
      code: "not_registered",
      message: "Objective is not registered on ObjectiveRegistry.",
    });
  }
  if (receipts.length === 0) {
    gaps.push({
      code: "no_executions",
      message: "No execution receipts for this objective.",
    });
  } else {
    if (receipts.every((row) => row.settlement === "staged")) {
      gaps.push({
        code: "staged_only",
        message: "Every receipt is staged. None are on-chain.",
      });
    }
    if (
      receipts.some((row) => row.settlement === "vault" && !row.verifiedOnChain)
    ) {
      gaps.push({
        code: "vault_unverified",
        message:
          "At least one vault receipt has no independent settlement record yet.",
      });
    }
    if (receipts.some((row) => !row.valid)) {
      gaps.push({
        code: "invalid_receipt",
        message: "At least one receipt failed local validation. Do not trust it.",
      });
    }
  }
  if (input.settlements.length === 0) {
    gaps.push({
      code: "no_settlements",
      message: "No chain settlement records linked to this objective.",
    });
  }
  if (timeline.length === 0) {
    gaps.push({
      code: "no_timeline",
      message: "No timeline events for this objective.",
    });
  }

  return {
    objectiveId: input.objective.id,
    objectiveName: input.objective.name,
    policySummary,
    healthState: input.health?.state ?? null,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    registry: registered
      ? { present: true, record: registered }
      : { present: false },
    receipts,
    settlements: input.settlements,
    timeline,
    gaps,
    message: auditTrailMessage({
      registered: Boolean(registered),
      receiptCount: receipts.length,
      settlementCount: input.settlements.length,
      invalid: receipts.some((row) => !row.valid),
      chainVerified: receipts.some((row) => row.verifiedOnChain),
    }),
  };
}

export function formatAuditTrailLines(trail: FinancialAuditTrail): string[] {
  const lines = [
    `Objective  ${trail.objectiveName} (${trail.objectiveId})`,
    `Policy     ${trail.policySummary}`,
    `Health     ${trail.healthState ?? "unknown"}`,
    `Registry   ${trail.registry.present ? "registered on-chain" : "not registered"}`,
    `Receipts   ${trail.receipts.length}`,
    `Settlements ${trail.settlements.length}`,
    `Timeline   ${trail.timeline.length}`,
  ];
  if (trail.gaps.length > 0) {
    lines.push("Gaps");
    for (const gap of trail.gaps) {
      lines.push(`  - ${gap.message}`);
    }
  }
  lines.push(trail.message);
  return lines;
}

function auditTrailMessage(input: {
  registered: boolean;
  receiptCount: number;
  settlementCount: number;
  invalid: boolean;
  chainVerified: boolean;
}): string {
  if (input.invalid) {
    return "Audit trail assembled with dishonest or incomplete receipts. Do not treat success text as proof.";
  }
  if (input.receiptCount === 0) {
    return "Audit trail shows the objective only. No restore has been recorded yet.";
  }
  if (input.chainVerified && input.registered) {
    return "Audit trail complete on testnet: registered objective, receipts, and chain settlement. Not mainnet.";
  }
  if (input.chainVerified) {
    return "Receipts include chain settlement proof. Objective is not registered on-chain.";
  }
  if (input.settlementCount === 0) {
    return "Audit trail shows receipts without chain settlement records. Staged or unverified vault — not independent proof.";
  }
  return "Audit trail assembled from what exists. Gaps are labeled. Nothing missing was invented.";
}
