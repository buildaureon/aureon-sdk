/**
 * @fileoverview Execution receipt + restore-plan types.
 *
 * Receipts may settle as vault on-chain rebalance (`settlement: "vault"`) or
 * as a staged capital-book update (`settlement: "staged"`) when the vault
 * path is unavailable. Wrap/unwrap ETH↔WETH is client-side via RestorePlan.
 */

import type { RegistryRef } from "./registry.js";
import type { SettlementRecord } from "./settlement.js";
import type { TimelineEvent } from "./timeline.js";

export interface ExecutionReceipt {
  id: string;
  objectiveId: string;
  status: "pending" | "submitted" | "confirmed" | "failed";
  transactionHash: string;
  action: string;
  notionalAdjustedUsd: number;
  result: string;
  createdAt: string;
  confirmedAt: string | null;
  /**
   * `"vault"`: keeper rebalance confirmed (or pending_vault_* then confirmed).
   * `"staged"`: capital-book restore only (honest non-finality label).
   */
  settlement: "staged" | "vault";
  /** Block explorer link when vault tx is a real `0x…` hash; null for staged. */
  explorerUrl?: string | null;
  registryRef?: RegistryRef;
  /** True when a settlement record exists for this execution (vault only). */
  verifiedOnChain?: boolean;
  /** Populated when verifiedOnChain is true. */
  settlementRecord?: SettlementRecord;
}

/** Client-side restore action: wrap/unwrap ETH↔WETH or keeper vault swap. */
export type RestorePlanKind = "wrap_eth" | "unwrap_weth" | "vault_swap";

export interface RestorePlan {
  kind: RestorePlanKind;
  amountHuman: string;
  approxUsd: number;
  message: string;
  sellSymbol?: string;
  buySymbol?: string;
}

export function isConfirmedExecution(receipt: ExecutionReceipt): boolean {
  return receipt.status === "confirmed" && Boolean(receipt.confirmedAt);
}

export function shortTransactionHash(hash: string, head = 10, tail = 6): string {
  if (hash.length <= head + tail + 1) return hash;
  return `${hash.slice(0, head)}…${hash.slice(-tail)}`;
}

export function sortExecutionsNewestFirst(
  receipts: ExecutionReceipt[]
): ExecutionReceipt[] {
  return [...receipts].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

/** True when the receipt claims vault (on-chain) settlement. */
export function isVaultSettlement(receipt: ExecutionReceipt): boolean {
  return receipt.settlement === "vault";
}

/** True when the receipt has independent on-chain settlement proof. */
export function isChainVerifiedReceipt(receipt: ExecutionReceipt): boolean {
  return receipt.verifiedOnChain === true;
}

/** Human-readable one-line receipt summary for agents and logs. */
export function formatReceiptSummary(receipt: ExecutionReceipt): string {
  const settlementLabel =
    receipt.verifiedOnChain
      ? "vault settlement (chain-verified)"
      : receipt.settlement === "vault"
        ? "vault settlement (unverified on-chain)"
        : "staged settlement (capital book)";
  const parts = [receipt.action, settlementLabel, receipt.status];
  if (receipt.explorerUrl) parts.push(receipt.explorerUrl);
  if (receipt.registryRef) {
    parts.push(
      `registry ${shortTransactionHash(receipt.registryRef.objectiveKey, 8, 4)}`
    );
  }
  return parts.join(" · ");
}

/** Timeline events linked to a receipt via payload.executionId. */
export function findTimelineEventsForReceipt(
  events: TimelineEvent[],
  receipt: ExecutionReceipt
): TimelineEvent[] {
  return events.filter((event) => {
    if (
      event.type !== "execution_started" &&
      event.type !== "execution_completed"
    ) {
      return false;
    }
    const executionId = event.payload?.executionId;
    return typeof executionId === "string" && executionId === receipt.id;
  });
}
