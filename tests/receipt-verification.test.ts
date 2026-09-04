/**
 * @fileoverview Unit tests for receipt → verification helpers.
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  buildReceiptVerificationFlow,
  inferProofTier,
} from "../src/formatting/receipt-verification.js";
import { validateExecutionReceipt } from "../src/validation/receipt-validator.js";
import type { ExecutionReceipt } from "../src/types/execution.js";
import type { ExecutionSettlementLookup } from "../src/types/settlement.js";

const VAULT_TX =
  "0xabc123def4567890123456789012345678901234567890123456789012345678";

const stagedReceipt: ExecutionReceipt = {
  id: "exec-staged",
  objectiveId: "obj-1",
  status: "confirmed",
  transactionHash: "staged_local_hash",
  action: "Rebalance toward stable allocation target",
  notionalAdjustedUsd: 500,
  result: "Transaction successful — staged book restore",
  createdAt: "2026-08-22T00:00:00.000Z",
  confirmedAt: "2026-08-22T00:00:01.000Z",
  settlement: "staged",
  explorerUrl: null,
  verifiedOnChain: false,
};

const vaultReceipt: ExecutionReceipt = {
  ...stagedReceipt,
  id: "exec-vault",
  transactionHash: VAULT_TX,
  settlement: "vault",
  explorerUrl: `https://explorer.testnet.chain.robinhood.com/tx/${VAULT_TX}`,
  verifiedOnChain: false,
};

const verifiedVaultReceipt: ExecutionReceipt = {
  ...vaultReceipt,
  id: "exec-verified",
  verifiedOnChain: true,
  settlementRecord: {
    id: "settlement-1",
    executionId: "exec-verified",
    objectiveId: "obj-1",
    walletAddress: "0x1234567890123456789012345678901234567890",
    settlement: "vault",
    transactionHash: VAULT_TX,
    blockNumber: 100,
    logIndex: 0,
    vaultAddress: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
    tokenSell: "NVDA",
    tokenBuy: "USDG",
    amountIn: "1000",
    amountOut: "950",
    explorerUrl: `https://explorer.testnet.chain.robinhood.com/tx/${VAULT_TX}`,
    verifiedAt: "2026-08-22T00:00:05.000Z",
    status: "confirmed",
  },
};

test("inferProofTier maps validation and settlement states", () => {
  const stagedValidation = validateExecutionReceipt(stagedReceipt);
  assert.equal(inferProofTier(stagedReceipt, stagedValidation), "schema_valid");

  const badValidation = validateExecutionReceipt({
    ...stagedReceipt,
    verifiedOnChain: true,
  });
  assert.equal(inferProofTier(stagedReceipt, badValidation), "claim_only");

  const vaultValidation = validateExecutionReceipt(verifiedVaultReceipt);
  assert.equal(
    inferProofTier(verifiedVaultReceipt, vaultValidation),
    "chain_verified"
  );
});

test("buildReceiptVerificationFlow staged schema-valid path", () => {
  const flow = buildReceiptVerificationFlow({ receipt: stagedReceipt });

  assert.equal(flow.executionId, "exec-staged");
  assert.equal(flow.phases.claimed.settlement, "staged");
  assert.equal(flow.phases.validation.valid, true);
  assert.equal(flow.proofTier, "schema_valid");
  assert.equal(flow.currentPhase, "validated");
  assert.match(flow.message, /schema-valid/i);
});

test("buildReceiptVerificationFlow vault chain-verified path", () => {
  const settlement: ExecutionSettlementLookup = {
    executionId: "exec-verified",
    verifiedOnChain: true,
    settlement: verifiedVaultReceipt.settlementRecord!,
  };

  const flow = buildReceiptVerificationFlow({
    receipt: verifiedVaultReceipt,
    settlement,
  });

  assert.equal(flow.proofTier, "chain_verified");
  assert.equal(flow.currentPhase, "chain_verified");
  assert.match(flow.message, /on-chain settlement proof/i);
});

test("buildReceiptVerificationFlow validation failure path", () => {
  const dishonest = {
    ...stagedReceipt,
    explorerUrl: "https://explorer.testnet.chain.robinhood.com/tx/0xbad",
  };
  const flow = buildReceiptVerificationFlow({ receipt: dishonest });

  assert.equal(flow.phases.validation.valid, false);
  assert.equal(flow.proofTier, "claim_only");
  assert.equal(flow.currentPhase, "validation_failed");
  assert.match(flow.message, /failed validation/i);
});

test("buildReceiptVerificationFlow vault unverified stays schema_valid", () => {
  const flow = buildReceiptVerificationFlow({
    receipt: vaultReceipt,
    settlement: {
      executionId: "exec-vault",
      verifiedOnChain: false,
      settlement: null,
    },
  });

  assert.equal(flow.proofTier, "schema_valid");
  assert.equal(flow.currentPhase, "validated");
  assert.match(flow.message, /not yet chain-observed/i);
});
