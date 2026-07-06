/**
 * @fileoverview Vault overview + prepare-tx contracts for AureonVault.
 *
 * Reads come from GET /vault and GET /vault/status.
 * Writes are wallet-signed: prepareDeposit / prepareWithdraw return calldata
 * steps; the host (or agent signer) broadcasts them; the API never holds
 * user keys.
 */

/** Allowlisted vault token metadata from GET /vault. */
export interface VaultToken {
  symbol: string;
  name: string;
  address: string;
  decimals: number;
  category?: string;
}

/** Per-token vault balance for the session wallet. */
export interface VaultBalance {
  symbol: string;
  name: string;
  /** ERC-20 token address held inside the vault accounting. */
  token: string;
  decimals: number;
  category?: string;
  /** Raw integer amount as a decimal string (wei / token base units). */
  raw: string;
  quantity: number;
  markPriceUsd: number | null;
  notionalUsd: number | null;
}

/** Full vault overview for the authenticated wallet. */
export interface VaultOverview {
  address: string;
  chainId: number;
  tokens: VaultToken[];
  balances: VaultBalance[];
  poolAddress: string | null;
  explorerBase: string;
  keeperAddress: string | null;
}

/** Compact funding signal used before restore. */
export interface VaultStatus {
  empty: boolean;
  totalNotionalUsd: number;
  canRestore: boolean;
}

/** One wallet-signed step from prepareDeposit / prepareWithdraw. */
export interface VaultPreparedStep {
  to: string;
  data: string;
  /** Native wei as a decimal string (`"0"` for ERC-20 paths). */
  value: string;
  functionName: "approve" | "deposit" | "depositETH" | "withdraw";
  label: string;
}

/**
 * Calldata plan for vault deposit or withdraw.
 * Sign `steps` in order with the session wallet (and matching `chainId`).
 */
export interface VaultPrepareResult {
  chainId: number;
  vaultAddress: string;
  explorerBase: string;
  symbol: string;
  amountRaw: string;
  amountHuman: string;
  steps: VaultPreparedStep[];
}

/** Native ETH or any allowlisted vault ERC-20 symbol (WETH, stables, …). */
export type VaultDepositSymbol = string;

/** Any allowlisted vault ERC-20 (not native ETH, use WETH). */
export type VaultWithdrawSymbol = string;
