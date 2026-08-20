/**
 * @fileoverview Day 9 — receipt validator pass/fail matrix.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { AureonValidationError } from "../src/errors/base.js";
import {
  assertValidExecutionReceipt,
  isValidExecutionReceipt,
  validateExecutionReceipt,
  validateSettlementRecord,
} from "../src/validation/receipt-validator.js";
import type { ExecutionReceipt } from "../src/types/execution.js";

const VAULT_TX =
  "0xabc123def4567890123456789012345678901234567890123456789012345678";

function validVaultReceipt(
  overrides: Partial<ExecutionReceipt> = {}
): ExecutionReceipt {
  return {
    id: "exec_valid",
    objectiveId: "obj_valid",
    status: "confirmed",
    transactionHash: VAULT_TX,
    action: "Vault restore",
    notionalAdjustedUsd: 100,
    result: "ok",
    createdAt: "2026-08-22T00:00:00.000Z",
    confirmedAt: "2026-08-22T00:00:01.000Z",
    settlement: "vault",
    explorerUrl: `https://explorer.testnet.chain.robinhood.com/tx/${VAULT_TX}`,
    verifiedOnChain: false,
    ...overrides,
  };
}

function validStagedReceipt(): ExecutionReceipt {
  return {
    id: "exec_staged",
    objectiveId: "obj_staged",
    status: "confirmed",
    transactionHash: "staged_local_hash_abc",
    action: "Staged restore",
    notionalAdjustedUsd: 50,
    result: "book update",
    createdAt: "2026-08-22T00:00:00.000Z",
    confirmedAt: "2026-08-22T00:00:01.000Z",
    settlement: "staged",
    verifiedOnChain: false,
  };
}

test("validateExecutionReceipt accepts valid vault receipt", () => {
  const result = validateExecutionReceipt(validVaultReceipt());
  assert.equal(result.valid, true);
  assert.equal(result.issues.length, 0);
  assert.equal(isValidExecutionReceipt(validVaultReceipt()), true);
});

test("validateExecutionReceipt accepts valid staged receipt", () => {
  const result = validateExecutionReceipt(validStagedReceipt());
  assert.equal(result.valid, true);
});

test("validateExecutionReceipt accepts pending_vault hash without explorer", () => {
  const result = validateExecutionReceipt(
    validVaultReceipt({
      transactionHash: "pending_vault_exec_valid",
      explorerUrl: null,
      status: "submitted",
      confirmedAt: null,
    })
  );
  assert.equal(result.valid, true);
});

test("staged receipt with explorerUrl fails", () => {
  const result = validateExecutionReceipt({
    ...validStagedReceipt(),
    explorerUrl: "https://explorer.testnet.chain.robinhood.com/tx/0xbad",
  });
  assert.equal(result.valid, false);
  assert.ok(result.issues.some((i) => i.code === "STAGED_WITH_EXPLORER"));
});

test("staged receipt verifiedOnChain fails", () => {
  const result = validateExecutionReceipt({
    ...validStagedReceipt(),
    verifiedOnChain: true,
  });
  assert.equal(result.valid, false);
  assert.ok(result.issues.some((i) => i.code === "STAGED_VERIFIED_ON_CHAIN"));
});

test("vault confirmed tx without explorerUrl fails", () => {
  const result = validateExecutionReceipt(
    validVaultReceipt({ explorerUrl: null })
  );
  assert.equal(result.valid, false);
  assert.ok(result.issues.some((i) => i.code === "VAULT_MISSING_EXPLORER"));
});

test("verifiedOnChain without settlementRecord fails", () => {
  const result = validateExecutionReceipt(
    validVaultReceipt({ verifiedOnChain: true })
  );
  assert.equal(result.valid, false);
  assert.ok(result.issues.some((i) => i.code === "VERIFIED_WITHOUT_RECORD"));
});

test("verifiedOnChain with matching settlementRecord passes", () => {
  const receipt = validVaultReceipt({
    verifiedOnChain: true,
    settlementRecord: {
      id: "settlement_1",
      executionId: "exec_valid",
      objectiveId: "obj_valid",
      walletAddress: "0x1111111111111111111111111111111111111111",
      settlement: "vault",
      transactionHash: VAULT_TX,
      blockNumber: 42,
      logIndex: 1,
      vaultAddress: "0x2222222222222222222222222222222222222222",
      tokenSell: "0x3333333333333333333333333333333333333333",
      tokenBuy: "0x4444444444444444444444444444444444444444",
      amountIn: "1000",
      amountOut: "900",
      explorerUrl: `https://explorer.testnet.chain.robinhood.com/tx/${VAULT_TX}`,
      verifiedAt: "2026-08-22T00:00:02.000Z",
      status: "confirmed",
    },
  });
  const result = validateExecutionReceipt(receipt);
  assert.equal(result.valid, true);
});

test("invalid registryRef fails", () => {
  const result = validateExecutionReceipt(
    validVaultReceipt({
      registryRef: { objectiveKey: "not-hex", contractAddress: "bad" },
    })
  );
  assert.equal(result.valid, false);
  assert.ok(result.issues.some((i) => i.code === "INVALID_REGISTRY_REF"));
});

test("assertValidExecutionReceipt throws with issues in details", () => {
  assert.throws(
    () => assertValidExecutionReceipt({ settlement: "bogus" }),
    (err: unknown) => {
      assert.ok(err instanceof AureonValidationError);
      const details = err.details as { issues: unknown[] };
      assert.ok(Array.isArray(details?.issues));
      assert.ok(details.issues.length > 0);
      return true;
    }
  );
});

test("validateSettlementRecord checks required fields", () => {
  const result = validateSettlementRecord({});
  assert.equal(result.valid, false);
  assert.ok(result.issues.some((i) => i.code === "MISSING_FIELD"));
});
