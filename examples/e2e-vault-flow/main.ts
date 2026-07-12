/**
 * @fileoverview Live SDK e2e against local AUREON API + Robinhood testnet vault.
 *
 * Exercises: wallet auth → sync → vault prepare deposit/withdraw (signed) →
 * createObjective (Automatic) → restore plan.
 *
 * Env (loaded from backend/.env + .secrets automatically when unset):
 *   AUREON_API_URL   default http://127.0.0.1:8787
 *   AUREON_API_KEY   from backend/.env AUREON_API_KEYS (first key)
 *   AUREON_E2E_KEY   hex private key (defaults to vault-deployer.key)
 *
 *   pnpm --filter @aureon/sdk exec tsx examples/e2e-vault-flow/main.ts
 */

import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
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
  isAureonError,
  LOCAL_API_BASE_URL,
} from "../../src/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "../../..");
const BACKEND = join(ROOT, "backend");

function loadDotEnv(path: string): Record<string, string> {
  if (!existsSync(path)) return {};
  const out: Record<string, string> = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const i = trimmed.indexOf("=");
    if (i < 0) continue;
    out[trimmed.slice(0, i)] = trimmed.slice(i + 1).trim();
  }
  return out;
}

function firstApiKey(raw: string | undefined): string | null {
  if (!raw) return null;
  const key = raw.split(",")[0]?.trim();
  return key || null;
}

function loadPrivateKey(): Hex {
  if (process.env.AUREON_E2E_KEY?.startsWith("0x")) {
    return process.env.AUREON_E2E_KEY as Hex;
  }
  const fromEnv = loadDotEnv(join(BACKEND, ".env")).AUREON_VAULT_DEPLOYER_KEY;
  if (fromEnv?.startsWith("0x")) return fromEnv as Hex;
  const keyPath = join(BACKEND, ".secrets/vault-deployer.key");
  if (!existsSync(keyPath)) {
    throw new Error("Missing AUREON_E2E_KEY / vault-deployer.key");
  }
  const hex = readFileSync(keyPath, "utf8").trim();
  if (!/^0x[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error("vault-deployer.key must be a 32-byte hex private key");
  }
  return hex as Hex;
}

function log(step: string, data?: unknown): void {
  if (data === undefined) {
    console.log(`✓ ${step}`);
    return;
  }
  console.log(`✓ ${step}`, data);
}

async function main(): Promise<void> {
  const env = loadDotEnv(join(BACKEND, ".env"));
  const baseUrl =
    process.env.AUREON_API_URL ?? env.AUREON_API_URL ?? LOCAL_API_BASE_URL;
  const apiKey =
    process.env.AUREON_API_KEY ?? firstApiKey(env.AUREON_API_KEYS);
  const rpcUrl = env.AUREON_RPC_URL ?? "https://rpc.testnet.chain.robinhood.com";
  const chainId = Number(env.AUREON_CHAIN_ID ?? 46630);

  if (!apiKey) throw new Error("AUREON_API_KEY / AUREON_API_KEYS missing");

  const account = privateKeyToAccount(loadPrivateKey());
  const publicClient = createPublicClient({ transport: http(rpcUrl) });
  const walletClient = createWalletClient({
    account,
    transport: http(rpcUrl),
  });

  const session = createSessionTokenProvider(null);
  const aureon = createAureonClient({
    baseUrl,
    apiKey,
    getAccessToken: session.getAccessToken,
  });

  const ping = await aureon.ping();
  log("ping", ping);

  const { message } = await aureon.getAuthNonce(account.address);
  const signature = await walletClient.signMessage({
    account,
    message,
  });
  const login = await aureon.verifyWallet({
    address: account.address,
    message,
    signature,
  });
  session.setToken(login.token);
  log("auth", { wallet: login.walletAddress });

  const me = await aureon.me();
  if (me.walletAddress.toLowerCase() !== account.address.toLowerCase()) {
    throw new Error("session wallet mismatch");
  }

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
      chain: {
        id: chainId,
        name: "Robinhood Chain Testnet",
        nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
        rpcUrls: { default: { http: [rpcUrl] } },
      },
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

  const withdrawAmount = "0.00005";
  const withdraw = await aureon.prepareVaultWithdraw({
    amount: withdrawAmount,
  });
  for (const step of withdraw.steps) {
    const hash = await walletClient.sendTransaction({
      account,
      chain: {
        id: chainId,
        name: "Robinhood Chain Testnet",
        nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
        rpcUrls: { default: { http: [rpcUrl] } },
      },
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
  if (!(wethAfterWithdraw < wethAfterDeposit)) {
    throw new Error("expected vault WETH to decrease after withdraw");
  }

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
    summary: objective.policy.summary,
  });
  if (objective.automationMode !== "auto") {
    throw new Error(
      `SDK create must default to auto, got ${objective.automationMode}`
    );
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
      log("getRestorePlan (expected if already in band)", {
        code: err.code,
        message: err.message,
      });
    } else {
      throw err;
    }
  }

  console.log("\nE2E OK : vault up/down + Automatic objective via SDK");
}

main().catch((error) => {
  if (isAureonError(error)) {
    console.error(`${error.code}: ${error.message}`);
  } else {
    console.error(error instanceof Error ? error.message : error);
  }
  process.exitCode = 1;
});
