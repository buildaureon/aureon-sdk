/**
 * @fileoverview Phase 2 execution receipt validator — schema + honesty rules.
 */

import { AureonValidationError } from "../errors/base.js";
import type { ExecutionReceipt } from "../types/execution.js";

const EXECUTION_STATUSES = new Set([
  "pending",
  "submitted",
  "confirmed",
  "failed",
]);

const SETTLEMENTS = new Set(["vault", "staged"]);

const TX_HASH_0X = /^0x[a-fA-F0-9]{64}$/;
const ADDRESS_0X = /^0x[a-fA-F0-9]{40}$/;
const BYTES32_0X = /^0x[a-fA-F0-9]{64}$/;
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T/;

export type ReceiptValidationCode =
  | "INVALID_INPUT"
  | "MISSING_FIELD"
  | "INVALID_SETTLEMENT"
  | "INVALID_STATUS"
  | "MISSING_CONFIRMED_AT"
  | "STAGED_WITH_EXPLORER"
  | "STAGED_VERIFIED_ON_CHAIN"
  | "STAGED_WITH_SETTLEMENT_RECORD"
  | "INVALID_VAULT_HASH"
  | "VAULT_MISSING_EXPLORER"
  | "VERIFIED_WITHOUT_RECORD"
  | "VERIFIED_RECORD_MISMATCH"
  | "INVALID_REGISTRY_REF"
  | "INVALID_SETTLEMENT_RECORD";

export type ReceiptValidationIssue = {
  code: ReceiptValidationCode;
  message: string;
  path?: string;
};

export type ReceiptValidationResult = {
  valid: boolean;
  issues: ReceiptValidationIssue[];
};

function issue(
  code: ReceiptValidationCode,
  message: string,
  path?: string
): ReceiptValidationIssue {
  return path ? { code, message, path } : { code, message };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isVaultTransactionHash(hash: string): boolean {
  return hash.startsWith("pending_vault_") || TX_HASH_0X.test(hash);
}

function isRealVaultTxHash(hash: string): boolean {
  return TX_HASH_0X.test(hash);
}

function isStagedTransactionHash(hash: string): boolean {
  return !isVaultTransactionHash(hash);
}

/** Validates a settlement record nested on a receipt. */
export function validateSettlementRecord(
  input: unknown,
  options: { executionId?: string } = {}
): ReceiptValidationResult {
  const issues: ReceiptValidationIssue[] = [];
  if (!isRecord(input)) {
    return {
      valid: false,
      issues: [issue("INVALID_INPUT", "Settlement record must be an object")],
    };
  }

  const requiredStrings: Array<[string, string]> = [
    ["id", "id"],
    ["walletAddress", "walletAddress"],
    ["transactionHash", "transactionHash"],
    ["vaultAddress", "vaultAddress"],
    ["tokenSell", "tokenSell"],
    ["tokenBuy", "tokenBuy"],
    ["amountIn", "amountIn"],
    ["amountOut", "amountOut"],
    ["explorerUrl", "explorerUrl"],
    ["verifiedAt", "verifiedAt"],
    ["status", "status"],
  ];

  for (const [key, path] of requiredStrings) {
    if (!isNonEmptyString(input[key])) {
      issues.push(issue("MISSING_FIELD", `Missing ${key}`, path));
    }
  }

  if (input.settlement !== "vault") {
    issues.push(
      issue(
        "INVALID_SETTLEMENT_RECORD",
        'settlement must be "vault" on chain records',
        "settlement"
      )
    );
  }

  if (
    typeof input.blockNumber !== "number" ||
    !Number.isFinite(input.blockNumber) ||
    input.blockNumber < 0
  ) {
    issues.push(
      issue("INVALID_SETTLEMENT_RECORD", "blockNumber must be a non-negative number", "blockNumber")
    );
  }

  if (
    typeof input.logIndex !== "number" ||
    !Number.isInteger(input.logIndex) ||
    input.logIndex < 0
  ) {
    issues.push(
      issue("INVALID_SETTLEMENT_RECORD", "logIndex must be a non-negative integer", "logIndex")
    );
  }

  const tx = String(input.transactionHash ?? "");
  if (tx && !TX_HASH_0X.test(tx)) {
    issues.push(
      issue("INVALID_SETTLEMENT_RECORD", "transactionHash must be a 32-byte hex hash", "transactionHash")
    );
  }

  if (input.status !== "confirmed" && input.status !== "orphan") {
    issues.push(
      issue(
        "INVALID_SETTLEMENT_RECORD",
        'status must be "confirmed" or "orphan"',
        "status"
      )
    );
  }

  if (
    options.executionId &&
    input.executionId != null &&
    input.executionId !== options.executionId
  ) {
    issues.push(
      issue(
        "VERIFIED_RECORD_MISMATCH",
        "settlementRecord.executionId must match receipt.id",
        "executionId"
      )
    );
  }

  if (isRecord(input.registryRef)) {
    const refIssues = validateRegistryRef(input.registryRef, "registryRef");
    issues.push(...refIssues);
  }

  return { valid: issues.length === 0, issues };
}

function validateRegistryRef(
  ref: Record<string, unknown>,
  basePath: string
): ReceiptValidationIssue[] {
  const issues: ReceiptValidationIssue[] = [];
  const objectiveKey = ref.objectiveKey;
  const contractAddress = ref.contractAddress;

  if (!isNonEmptyString(objectiveKey) || !BYTES32_0X.test(objectiveKey)) {
    issues.push(
      issue(
        "INVALID_REGISTRY_REF",
        "objectiveKey must be a 32-byte hex string",
        `${basePath}.objectiveKey`
      )
    );
  }
  if (!isNonEmptyString(contractAddress) || !ADDRESS_0X.test(contractAddress)) {
    issues.push(
      issue(
        "INVALID_REGISTRY_REF",
        "contractAddress must be a 20-byte hex address",
        `${basePath}.contractAddress`
      )
    );
  }
  return issues;
}

/**
 * Validates an execution receipt against the Phase 2 contract + honesty rules.
 * Never throws — inspect `valid` and `issues`.
 */
export function validateExecutionReceipt(input: unknown): ReceiptValidationResult {
  const issues: ReceiptValidationIssue[] = [];

  if (!isRecord(input)) {
    return {
      valid: false,
      issues: [issue("INVALID_INPUT", "Receipt must be an object")],
    };
  }

  const required: Array<[string, string]> = [
    ["id", "id"],
    ["objectiveId", "objectiveId"],
    ["action", "action"],
    ["status", "status"],
    ["transactionHash", "transactionHash"],
    ["result", "result"],
    ["createdAt", "createdAt"],
    ["settlement", "settlement"],
  ];

  for (const [key, path] of required) {
    if (!isNonEmptyString(input[key])) {
      issues.push(issue("MISSING_FIELD", `Missing ${key}`, path));
    }
  }

  const settlement = input.settlement;
  if (settlement != null && !SETTLEMENTS.has(String(settlement))) {
    issues.push(
      issue(
        "INVALID_SETTLEMENT",
        'settlement must be "vault" or "staged"',
        "settlement"
      )
    );
  }

  const status = input.status;
  if (status != null && !EXECUTION_STATUSES.has(String(status))) {
    issues.push(
      issue(
        "INVALID_STATUS",
        "status must be pending, submitted, confirmed, or failed",
        "status"
      )
    );
  }

  if (status === "confirmed" && !isNonEmptyString(input.confirmedAt)) {
    issues.push(
      issue("MISSING_CONFIRMED_AT", "confirmed status requires confirmedAt", "confirmedAt")
    );
  }

  if (isNonEmptyString(input.createdAt) && !ISO_TIMESTAMP.test(input.createdAt)) {
    issues.push(
      issue("MISSING_FIELD", "createdAt must be an ISO-8601 timestamp", "createdAt")
    );
  }

  const txHash = String(input.transactionHash ?? "");
  const settlementStr = String(settlement ?? "");

  if (settlementStr === "staged") {
    if (input.explorerUrl != null && input.explorerUrl !== "") {
      issues.push(
        issue(
          "STAGED_WITH_EXPLORER",
          "staged receipts must not include explorerUrl",
          "explorerUrl"
        )
      );
    }
    if (input.verifiedOnChain === true) {
      issues.push(
        issue(
          "STAGED_VERIFIED_ON_CHAIN",
          "staged receipts cannot be verifiedOnChain",
          "verifiedOnChain"
        )
      );
    }
    if (input.settlementRecord != null) {
      issues.push(
        issue(
          "STAGED_WITH_SETTLEMENT_RECORD",
          "staged receipts must not include settlementRecord",
          "settlementRecord"
        )
      );
    }
    if (txHash && !isStagedTransactionHash(txHash)) {
      issues.push(
        issue(
          "INVALID_VAULT_HASH",
          "staged settlement must not use a vault transaction hash",
          "transactionHash"
        )
      );
    }
  }

  if (settlementStr === "vault") {
    if (txHash && !isVaultTransactionHash(txHash)) {
      issues.push(
        issue(
          "INVALID_VAULT_HASH",
          "vault settlement requires 0x… hash or pending_vault_* prefix",
          "transactionHash"
        )
      );
    }
    if (isRealVaultTxHash(txHash)) {
      if (input.explorerUrl == null || input.explorerUrl === "") {
        issues.push(
          issue(
            "VAULT_MISSING_EXPLORER",
            "confirmed vault tx must include explorerUrl",
            "explorerUrl"
          )
        );
      }
    }
  }

  if (input.verifiedOnChain === true) {
    if (settlementStr !== "vault") {
      issues.push(
        issue(
          "VERIFIED_WITHOUT_RECORD",
          "verifiedOnChain requires vault settlement",
          "verifiedOnChain"
        )
      );
    }
    if (input.settlementRecord == null) {
      issues.push(
        issue(
          "VERIFIED_WITHOUT_RECORD",
          "verifiedOnChain requires settlementRecord",
          "verifiedOnChain"
        )
      );
    } else {
      const nested = validateSettlementRecord(input.settlementRecord, {
        executionId: isNonEmptyString(input.id) ? input.id : undefined,
      });
      for (const nestedIssue of nested.issues) {
        issues.push({
          ...nestedIssue,
          path: nestedIssue.path
            ? `settlementRecord.${nestedIssue.path}`
            : "settlementRecord",
        });
      }
    }
  } else if (input.settlementRecord != null && input.verifiedOnChain !== false) {
    // settlementRecord without verifiedOnChain flag is inconsistent
    if (input.verifiedOnChain !== true) {
      issues.push(
        issue(
          "VERIFIED_RECORD_MISMATCH",
          "settlementRecord present but verifiedOnChain is not true",
          "verifiedOnChain"
        )
      );
    }
  }

  if (isRecord(input.registryRef)) {
    issues.push(...validateRegistryRef(input.registryRef, "registryRef"));
  }

  return { valid: issues.length === 0, issues };
}

/** Type guard: true when input passes validateExecutionReceipt. */
export function isValidExecutionReceipt(input: unknown): input is ExecutionReceipt {
  return validateExecutionReceipt(input).valid;
}

/** Throws AureonValidationError when the receipt fails validation. */
export function assertValidExecutionReceipt(receipt: unknown): asserts receipt is ExecutionReceipt {
  const result = validateExecutionReceipt(receipt);
  if (!result.valid) {
    throw new AureonValidationError("Invalid execution receipt", {
      issues: result.issues,
    });
  }
}
