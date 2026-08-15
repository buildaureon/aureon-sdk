/**
 * @fileoverview On-chain settlement record for vault rebalances (Day 8).
 */

import type { RegistryRef } from "./registry.js";

export type SettlementStatus = "confirmed" | "orphan";

export interface SettlementRecord {
  id: string;
  executionId: string | null;
  objectiveId: string | null;
  walletAddress: string;
  /** Chain-verified vault settlements are always `"vault"`. */
  settlement: "vault";
  transactionHash: string;
  blockNumber: number;
  logIndex: number;
  vaultAddress: string;
  tokenSell: string;
  tokenBuy: string;
  amountIn: string;
  amountOut: string;
  explorerUrl: string;
  verifiedAt: string;
  status: SettlementStatus;
  registryRef?: RegistryRef;
}

export interface ExecutionSettlementLookup {
  executionId: string;
  verifiedOnChain: boolean;
  settlement: SettlementRecord | null;
}

/** Human-readable settlement summary for agents and logs. */
export function formatSettlementSummary(record: SettlementRecord): string {
  const parts = [
    "vault settlement (chain-verified)",
    `block ${record.blockNumber}`,
    record.explorerUrl,
  ];
  if (record.registryRef) {
    parts.push(`registry ${record.registryRef.objectiveKey.slice(0, 10)}…`);
  }
  return parts.join(" · ");
}
