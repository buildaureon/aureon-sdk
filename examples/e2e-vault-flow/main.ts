/**
 * @fileoverview Live vault deposit/withdraw + Automatic objective against the AUREON API.
 *
 * Env (integrators only — no local repo files):
 *   AUREON_API_KEY            issued developer key (required)
 *   AUREON_API_URL            optional (default https://api.aureonlabs.network)
 *   AUREON_WALLET_PRIVATE_KEY 0x… key used to sign auth + broadcast vault txs (required)
 *   AUREON_RPC_URL            optional (default Robinhood testnet RPC)
 *   AUREON_CHAIN_ID           optional (default 46630)
 *
 *   pnpm --filter @buildaureon/sdk example:e2e
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  createAureonClient,
  createSessionTokenProvider,
  DEFAULT_API_BASE_URL,
  isAureonError,
} from "../../src/index.js";

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Set ${name}`);
  return value;
}

function loadPrivateKey(): Hex {
  const key = requireEnv("AUREON_WALLET_PRIVATE_KEY");
  if (!/^0x[0-9a-fA-F]{64}$/.test(key)) {
    throw new Error("AUREON_WALLET_PRIVATE_KEY must be a 0x-prefixed 32-byte hex key");
  }
  return key as Hex;
}

function log(step: string, data?: unknown): void {
  if (data === undefined) {
    console.log(`✓ ${step}`);
    return;
  }
  console.log(`✓ ${step}`, data);
}

async function main(): Promise<void> {
  const baseUrl = process.env.AUREON_API_URL?.trim() || DEFAULT_API_BASE_URL;
  const apiKey = requireEnv("AUREON_API_KEY");
  const rpcUrl =
    process.env.AUREON_RPC_URL?.trim() ||
    "https://rpc.testnet.chain.robinhood.com";
  const chainId = Number(process.env.AUREON_CHAIN_ID ?? 46630);

  const account = privateKeyToAccount(loadPrivateKey());
  const publicClient = createPublicClient({ transport: http(rpcUrl) });
  const walletClient = createWalletClient({
    account,
    transport: http(rpcUrl),
  });
  const chain = {
    id: chainId,
    name: "Robinhood Chain Testnet",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl] } },
  } as const;

  const session = createSessionTokenProvider(null);
  const aureon = createAureonClient({
    baseUrl,
    apiKey,
    getAccessToken: session.getAccessToken,
  });

  const ping = await aureon.ping();
  log("ping", ping);

  const { message } = await aureon.getAuthNonce(account.address);
  const signature = await walletClient.signMessage({ account, message });
  const login = await aureon.verifyWallet({
    address: account.address,
    message,
    signature,
  });
  session.setToken(login.token);
  log("auth", { wallet: login.walletAddress });

  const synced = await aureon.syncPortfolio();
  log("syncPortfolio", {
    chainId: synced.chainId,
    positions: synced.portfolio.positions.length,
    totalNotionalUsd: synced.portfolio.totalNotionalUsd,
  });

  const vaultBefore = await aureon.getVault();
  const statusBefore = await aureon.getVaultStatus();
  const wethBefore =
    vaultBefore.balances.find((b) => b.symbol.toUpperCase() === "WETH")
      ?.quantity ?? 0;
  log("vault before", {
    address: vaultBefore.address,
    empty: statusBefore.empty,
    weth: wethBefore,
    canRestore: statusBefore.canRestore,
  });

  const depositAmount = "0.0001";
  const ethBal = await publicClient.getBalance({ address: account.address });
  if (ethBal < 200000000000000n) {
    throw new Error(
      `Wallet ${account.address} needs ≥0.0002 ETH for deposit+gas (have ${ethBal})`
    );
  }

  const deposit = await aureon.prepareVaultDeposit({
    symbol: "ETH",
    amount: depositAmount,
  });
  log("prepareVaultDeposit", {
    steps: deposit.steps.map((s) => s.functionName),
    amountHuman: deposit.amountHuman,
  });

  for (const step of deposit.steps) {
    const hash = await walletClient.sendTransaction({
      account,
      chain,
      to: step.to as `0x${string}`,
      data: step.data as Hex,
      value: BigInt(step.value),
    });
    await publicClient.waitForTransactionReceipt({ hash });
    log(`deposit tx ${step.functionName}`, { hash });
  }

  const vaultAfterDeposit = await aureon.getVault();
  const wethAfterDeposit =
    vaultAfterDeposit.balances.find((b) => b.symbol.toUpperCase() === "WETH")
      ?.quantity ?? 0;
  log("vault after deposit", { weth: wethAfterDeposit });
  if (!(wethAfterDeposit > wethBefore)) {
    throw new Error("expected vault WETH to increase after depositETH");
  }

  const withdraw = await aureon.prepareVaultWithdraw({ amount: "0.00005" });
  for (const step of withdraw.steps) {
    const hash = await walletClient.sendTransaction({
      account,
      chain,
      to: step.to as `0x${string}`,
      data: step.data as Hex,
      value: BigInt(step.value),
    });
    await publicClient.waitForTransactionReceipt({ hash });
    log(`withdraw tx ${step.functionName}`, { hash });
  }

  const vaultAfterWithdraw = await aureon.getVault();
  const wethAfterWithdraw =
    vaultAfterWithdraw.balances.find((b) => b.symbol.toUpperCase() === "WETH")
      ?.quantity ?? 0;
  log("vault after withdraw", { weth: wethAfterWithdraw });

  await aureon.syncPortfolio();

  const objective = await aureon.createObjective({
    name: `SDK E2E Auto ${Date.now()}`,
    kind: "balanced_portfolio",
    targetWeight: 0.2,
    tolerance: 0.05,
    targetSymbol: "WETH",
    priority: "high",
  });
  log("createObjective", {
    id: objective.id,
    automationMode: objective.automationMode,
  });
  if (objective.automationMode !== "auto") {
    throw new Error(`expected automationMode auto, got ${objective.automationMode}`);
  }

  const health = await aureon.getHealth(objective.id);
  log("health", health[0] ? { state: health[0].state, message: health[0].message } : null);

  try {
    const plan = await aureon.getRestorePlan(objective.id);
    log("getRestorePlan", {
      kind: plan.kind,
      amountHuman: plan.amountHuman,
      message: plan.message,
    });
  } catch (err) {
    if (isAureonError(err)) {
      log("getRestorePlan (ok if already in band)", {
        code: err.code,
        message: err.message,
      });
    } else {
      throw err;
    }
  }

  console.log("\nE2E OK — vault deposit/withdraw + Automatic objective");
}

main().catch((error) => {
  if (isAureonError(error)) {
    console.error(`${error.code}: ${error.message}`);
  } else {
    console.error(error instanceof Error ? error.message : error);
  }
  process.exitCode = 1;
});
