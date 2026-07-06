/**
 * @fileoverview Execution receipt + restore-plan types.
 *
 * Receipts may settle as vault on-chain rebalance (`settlement: "vault"`) or
 * as a staged capital-book update (`settlement: "staged"`) when the vault
 * path is unavailable. Wrap/unwrap ETH↔WETH is client-side via RestorePlan.
 */

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
  settlement?: "staged" | "vault";
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
