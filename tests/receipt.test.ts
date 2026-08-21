import assert from "node:assert/strict";
import test from "node:test";
import {
  formatReceiptSummary,
  findTimelineEventsForReceipt,
  isVaultSettlement,
  type ExecutionReceipt,
  type TimelineEvent,
} from "../src/types/index.js";

const stagedReceipt: ExecutionReceipt = {
  id: "exec_1",
  objectiveId: "obj_1",
  status: "confirmed",
  transactionHash: "staged_local_hash",
  action: "Rebalance toward stable allocation target",
  notionalAdjustedUsd: 500,
  result: "Staged book restore",
  createdAt: "2026-08-16T00:00:00.000Z",
  confirmedAt: "2026-08-16T00:00:01.000Z",
  settlement: "staged",
  explorerUrl: null,
};

const vaultReceipt: ExecutionReceipt = {
  ...stagedReceipt,
  id: "exec_2",
  transactionHash:
    "0xabc123def4567890123456789012345678901234567890123456789012345678",
  settlement: "vault",
  explorerUrl: "https://explorer.testnet.chain.robinhood.com/tx/0xabc",
  registryRef: {
    objectiveKey: "0xdeadbeef",
    contractAddress: "0x76d8f088d2abba3c73ff93f92308f8b59b250ea5",
  },
};

test("isVaultSettlement distinguishes settlement types", () => {
  assert.equal(isVaultSettlement(stagedReceipt), false);
  assert.equal(isVaultSettlement(vaultReceipt), true);
});

test("formatReceiptSummary includes settlement and proof hints", () => {
  const staged = formatReceiptSummary(stagedReceipt);
  assert.match(staged, /staged settlement/);
  assert.doesNotMatch(staged, /explorer/);

  const vault = formatReceiptSummary(vaultReceipt);
  assert.match(vault, /vault settlement/);
  assert.match(vault, /explorer/);
  assert.match(vault, /registry/);
});

test("findTimelineEventsForReceipt joins by executionId", () => {
  const events: TimelineEvent[] = [
    {
      id: "tl_1",
      objectiveId: "obj_1",
      type: "execution_started",
      message: "started",
      payload: { executionId: "exec_1", settlement: "staged" },
      createdAt: "2026-08-16T00:00:00.000Z",
    },
    {
      id: "tl_2",
      objectiveId: "obj_1",
      type: "execution_completed",
      message: "done",
      payload: { executionId: "exec_1", settlement: "staged" },
      createdAt: "2026-08-16T00:00:02.000Z",
    },
    {
      id: "tl_3",
      objectiveId: "obj_1",
      type: "violation_detected",
      message: "breach",
      payload: {},
      createdAt: "2026-08-16T00:00:03.000Z",
    },
  ];
  const linked = findTimelineEventsForReceipt(events, stagedReceipt);
  assert.equal(linked.length, 2);
  assert.equal(linked[0]?.type, "execution_started");
});

test("registry_registered is a valid timeline event type", async () => {
  const { isTimelineEventType } = await import("../src/types/index.js");
  assert.equal(isTimelineEventType("registry_registered"), true);
  assert.equal(isTimelineEventType("registry_anchored"), false);
});
