/**
 * @fileoverview Receipt → verification teaching flow helpers.
 */

import type { ExecutionReceipt } from "../types/execution.js";
import {
  formatReceiptSummary,
  isChainVerifiedReceipt,
} from "../types/execution.js";
import type { ExecutionSettlementLookup } from "../types/settlement.js";
import type { TimelineEvent } from "../types/timeline.js";
import type { ReceiptValidationResult } from "../validation/receipt-validator.js";
import { validateExecutionReceipt } from "../validation/receipt-validator.js";

export type ReceiptVerificationPhase =
  | "claimed"
  | "validated"
  | "validation_failed"
  | "chain_verified";

export type ReceiptProofTier =
  | "claim_only"
  | "schema_valid"
  | "chain_verified";

export interface ReceiptVerificationFlow {
  executionId: string;
  receipt: ExecutionReceipt;
  phases: {
    claimed: { summary: string; status: string; settlement: string; result: string };
    validation: ReceiptValidationResult;
    settlement?: ExecutionSettlementLookup;
    timelineEvents?: TimelineEvent[];
  };
  proofTier: ReceiptProofTier;
  currentPhase: ReceiptVerificationPhase;
  message: string;
}

/**
 * Infers proof tier from receipt, validation, and optional settlement lookup.
 */
export function inferProofTier(
  receipt: ExecutionReceipt,
  validation: ReceiptValidationResult,
  settlement?: ExecutionSettlementLookup
): ReceiptProofTier {
  if (!validation.valid) return "claim_only";
  if (
    settlement?.verifiedOnChain === true ||
    isChainVerifiedReceipt(receipt) ||
    receipt.verifiedOnChain === true
  ) {
    return "chain_verified";
  }
  return "schema_valid";
}

function inferCurrentPhase(
  validation: ReceiptValidationResult,
  proofTier: ReceiptProofTier
): ReceiptVerificationPhase {
  if (!validation.valid) return "validation_failed";
  if (proofTier === "chain_verified") return "chain_verified";
  return "validated";
}

/**
 * Builds the receipt → verification teaching shape.
 */
export function buildReceiptVerificationFlow(input: {
  receipt: ExecutionReceipt;
  validation?: ReceiptValidationResult;
  settlement?: ExecutionSettlementLookup;
  timelineEvents?: TimelineEvent[];
}): ReceiptVerificationFlow {
  const validation =
    input.validation ?? validateExecutionReceipt(input.receipt);
  const proofTier = inferProofTier(
    input.receipt,
    validation,
    input.settlement
  );
  const currentPhase = inferCurrentPhase(validation, proofTier);

  let message =
    "An AI saying 'transaction successful' is only a claim — validate the receipt before trusting it.";
  if (currentPhase === "validation_failed") {
    message =
      "Receipt failed validation — do not summarize as proof. Fix honesty issues before reporting success.";
  } else if (currentPhase === "chain_verified") {
    message =
      "Receipt passes validation and has independent on-chain settlement proof.";
  } else if (proofTier === "schema_valid") {
    const label =
      input.receipt.settlement === "staged"
        ? "staged (capital book)"
        : "vault (not yet chain-observed)";
    message = `Receipt passes validation (${label}). Schema-valid does not mean chain-verified — check settlement lookup for vault proof.`;
  }

  return {
    executionId: input.receipt.id,
    receipt: input.receipt,
    phases: {
      claimed: {
        summary: formatReceiptSummary(input.receipt),
        status: input.receipt.status,
        settlement: input.receipt.settlement,
        result: input.receipt.result,
      },
      validation,
      settlement: input.settlement,
      timelineEvents: input.timelineEvents,
    },
    proofTier,
    currentPhase,
    message,
  };
}
