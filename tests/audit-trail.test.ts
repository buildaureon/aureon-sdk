/**
 * @fileoverview Unit tests for financial audit trail join.
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  buildFinancialAuditTrail,
  formatAuditTrailLines,
} from "../src/formatting/audit-trail.js";
import type { ExecutionReceipt } from "../src/types/execution.js";
import type { Objective } from "../src/types/objective.js";
import type { SettlementRecord } from "../src/types/settlement.js";
import type { TimelineEvent } from "../src/types/timeline.js";

const VAULT_TX =
  "0xabc123def4567890123456789012345678901234567890123456789012345678";

const objective: Objective = {
  id: "obj-1",
  name: "Maintain 20% stables",
  kind: "stable_allocation",
  status: "active",
  priority: "high",
  automationMode: "auto",
  policy: {
    targetWeight: 0.2,
    tolerance: 0.02,
    summary: "Maintain 20.0% stable allocation within ±2.0%",
  },
  ownerId: "wallet-1",
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z",
  lastEvaluatedAt: "2026-08-22T00:00:00.000Z",
  lastExecutionId: "exec-1",
};

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

const settlement: SettlementRecord = {
  id: "settlement-1",
  executionId: "exec-vault",
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
};

const vaultReceipt: ExecutionReceipt = {
  ...stagedReceipt,
  id: "exec-vault",
  transactionHash: VAULT_TX,
  settlement: "vault",
  explorerUrl: `https://explorer.testnet.chain.robinhood.com/tx/${VAULT_TX}`,
  verifiedOnChain: true,
  settlementRecord: settlement,
};

const timeline: TimelineEvent[] = [
  {
    id: "tl-1",
    objectiveId: "obj-1",
    type: "execution_completed",
    message: "Restore completed",
    payload: { executionId: "exec-vault", settlement: "vault" },
    createdAt: "2026-08-22T00:00:01.000Z",
  },
];

test("buildFinancialAuditTrail labels missing registry and staged-only receipts", () => {
  const trail = buildFinancialAuditTrail({
    objective,
    registry: { registered: false, objectiveId: "obj-1" },
    receipts: [stagedReceipt],
    settlements: [],
    timeline,
    generatedAt: "2026-09-05T00:00:00.000Z",
  });

  assert.equal(trail.registry.present, false);
  assert.equal(trail.receipts[0]?.settlement, "staged");
  assert.equal(trail.receipts[0]?.valid, true);
  assert.ok(trail.gaps.some((gap) => gap.code === "not_registered"));
  assert.ok(trail.gaps.some((gap) => gap.code === "staged_only"));
  assert.ok(trail.gaps.some((gap) => gap.code === "no_settlements"));
  assert.match(trail.message, /without chain settlement/i);
});

test("buildFinancialAuditTrail never invents chain proof", () => {
  const trail = buildFinancialAuditTrail({
    objective,
    receipts: [],
    settlements: [],
    timeline: [],
  });

  assert.equal(trail.receipts.length, 0);
  assert.equal(trail.settlements.length, 0);
  assert.ok(trail.gaps.some((gap) => gap.code === "no_executions"));
  assert.match(trail.message, /No restore has been recorded/i);
});

test("buildFinancialAuditTrail joins registry + verified vault + settlement", () => {
  const trail = buildFinancialAuditTrail({
    objective,
    health: {
      objectiveId: "obj-1",
      state: "healthy",
      score: 96,
      currentMetric: 0.2,
      targetMetric: 0.2,
      deviation: 0,
      message: "On track",
      evaluatedAt: "2026-08-22T00:00:10.000Z",
    },
    registry: {
      registered: true,
      record: {
        objectiveId: "obj-1",
        objectiveKey: "0x".padEnd(66, "b"),
        configHash: "0x".padEnd(66, "c"),
        owner: "0x1234567890123456789012345678901234567890",
        status: "active",
        chainId: 46630,
        contractAddress: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
        transactionHash: VAULT_TX,
        blockNumber: 99,
        registeredAt: "2026-08-20T00:00:00.000Z",
        updatedAt: "2026-08-20T00:00:00.000Z",
        explorerUrl: `https://explorer.testnet.chain.robinhood.com/tx/${VAULT_TX}`,
        verifiedOnChain: true,
      },
    },
    receipts: [vaultReceipt],
    settlements: [settlement],
    timeline,
  });

  assert.equal(trail.registry.present, true);
  assert.equal(trail.receipts[0]?.verifiedOnChain, true);
  assert.equal(trail.settlements.length, 1);
  assert.equal(trail.timeline[0]?.executionId, "exec-vault");
  assert.equal(
    trail.gaps.some((gap) => gap.code === "not_registered"),
    false
  );
  assert.match(trail.message, /complete on testnet/i);
  assert.doesNotMatch(trail.message, /mainnet is live/i);

  const lines = formatAuditTrailLines(trail);
  assert.ok(lines.some((line) => /registered on-chain/.test(line)));
});

test("buildFinancialAuditTrail flags dishonest receipts", () => {
  const dishonest: ExecutionReceipt = {
    ...stagedReceipt,
    explorerUrl: "https://explorer.testnet.chain.robinhood.com/tx/0xbad",
  };
  const trail = buildFinancialAuditTrail({
    objective,
    receipts: [dishonest],
    settlements: [],
    timeline,
  });

  assert.equal(trail.receipts[0]?.valid, false);
  assert.ok(trail.gaps.some((gap) => gap.code === "invalid_receipt"));
  assert.match(trail.message, /Do not treat success text as proof/);
});
