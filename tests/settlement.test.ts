/**
 * @fileoverview Day 8 — settlement record types and receipt helpers.
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  formatReceiptSummary,
  isChainVerifiedReceipt,
  type ExecutionReceipt,
} from "../src/types/execution.js";
import { formatSettlementSummary, type SettlementRecord } from "../src/types/settlement.js";

const baseReceipt = (): ExecutionReceipt => ({
  id: "exec_1",
  objectiveId: "obj_1",
  status: "confirmed",
  transactionHash: "0xabc123def4567890123456789012345678901234567890123456789012345678",
  action: "Vault restore",
  notionalAdjustedUsd: 100,
  result: "ok",
  createdAt: "2026-08-19T00:00:00.000Z",
  confirmedAt: "2026-08-19T00:00:01.000Z",
  settlement: "vault",
});

test("isChainVerifiedReceipt respects verifiedOnChain flag", () => {
  assert.equal(isChainVerifiedReceipt(baseReceipt()), false);
  assert.equal(isChainVerifiedReceipt({ ...baseReceipt(), verifiedOnChain: true }), true);
  assert.equal(
    isChainVerifiedReceipt({ ...baseReceipt(), settlement: "staged", verifiedOnChain: false }),
    false
  );
});

test("formatReceiptSummary distinguishes verified vault vs unverified vault vs staged", () => {
  const verified = formatReceiptSummary({ ...baseReceipt(), verifiedOnChain: true });
  assert.ok(verified.includes("chain-verified"));

  const unverified = formatReceiptSummary(baseReceipt());
  assert.ok(unverified.includes("unverified on-chain"));

  const staged = formatReceiptSummary({ ...baseReceipt(), settlement: "staged" });
  assert.ok(staged.includes("staged settlement"));
});

test("formatSettlementSummary includes explorer link", () => {
  const record: SettlementRecord = {
    id: "settlement_1",
    executionId: "exec_1",
    objectiveId: "obj_1",
    walletAddress: "0x1111111111111111111111111111111111111111",
    settlement: "vault",
    transactionHash: "0xabc123def4567890123456789012345678901234567890123456789012345678",
    blockNumber: 42,
    logIndex: 1,
    vaultAddress: "0x2222222222222222222222222222222222222222",
    tokenSell: "0x3333333333333333333333333333333333333333",
    tokenBuy: "0x4444444444444444444444444444444444444444",
    amountIn: "1000",
    amountOut: "900",
    explorerUrl: "https://explorer.testnet.chain.robinhood.com/tx/0xabc",
    verifiedAt: "2026-08-19T00:00:00.000Z",
    status: "confirmed",
  };
  const summary = formatSettlementSummary(record);
  assert.ok(summary.includes("chain-verified"));
  assert.ok(summary.includes("block 42"));
});
