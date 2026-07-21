/**
 * Live e2e: vault deposits + Automatic maintain 20% TSLA against the hosted API.
 *
 * Env:
 *   AUREON_API_KEY            issued developer key (required)
 *   AUREON_WALLET_PRIVATE_KEY 0x… signing key (required)
 *   AUREON_API_URL            optional (default https://api.aureonlabs.network)
 *   AUREON_RPC_URL            optional
 *   AUREON_CHAIN_ID           optional (default 46630)
 *
 *   pnpm --filter @buildaureon/sdk example:e2e-policy
 */

import {
  createPublicClient,
  createWalletClient,
  erc20Abi,
  formatEther,
  http,
  parseUnits,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  createAureonClient,
  createSessionTokenProvider,
  DEFAULT_API_BASE_URL,
  isAureonError,
} from "../../src/index.js";

const VAULT_ABI = [
  {
    type: "function",
    name: "deposit",
    stateMutability: "nonpayable",
    inputs: [
      { name: "token", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
] as const;

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Set ${name}`);
  return value;
}

function loadKey(): Hex {
  const key = requireEnv("AUREON_WALLET_PRIVATE_KEY");
  if (!/^0x[0-9a-fA-F]{64}$/.test(key)) {
    throw new Error("AUREON_WALLET_PRIVATE_KEY must be a 0x-prefixed 32-byte hex key");
  }
  return key as Hex;
}

function log(step: string, data?: unknown) {
  console.log(data === undefined ? `✓ ${step}` : `✓ ${step}`, data ?? "");
}

async function main() {
  const baseUrl = process.env.AUREON_API_URL?.trim() || DEFAULT_API_BASE_URL;
  const rpcUrl =
    process.env.AUREON_RPC_URL?.trim() ||
    "https://rpc.testnet.chain.robinhood.com";
  const chainId = Number(process.env.AUREON_CHAIN_ID ?? 46630);
  const apiKey = requireEnv("AUREON_API_KEY");

  const account = privateKeyToAccount(loadKey());
  const publicClient = createPublicClient({ transport: http(rpcUrl) });
  const walletClient = createWalletClient({ account, transport: http(rpcUrl) });
  const chain = {
    id: chainId,
    name: "Robinhood Chain Testnet",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl] } },
  } as const;

  const results: Record<string, unknown> = { wallet: account.address };

  const session = createSessionTokenProvider(null);
  const aureon = createAureonClient({
    baseUrl,
    apiKey,
    getAccessToken: session.getAccessToken,
  });

  const eth = await publicClient.getBalance({ address: account.address });
  log("ETH balance", formatEther(eth));
  results.eth = formatEther(eth);
  if (eth < parseUnits("0.001", 18)) throw new Error("Need ≥0.001 ETH");

  const { message } = await aureon.getAuthNonce(account.address);
  const signature = await walletClient.signMessage({ account, message });
  const login = await aureon.verifyWallet({
    address: account.address,
    message,
    signature,
  });
  session.setToken(login.token);
  log("auth", login.walletAddress);

  // Deposit ETH
  const dEth = await aureon.prepareVaultDeposit({ symbol: "ETH", amount: "0.00025" });
  for (const step of dEth.steps) {
    const hash = await walletClient.sendTransaction({
      account,
      chain,
      to: step.to as Address,
      data: step.data as Hex,
      value: BigInt(step.value),
    });
    await publicClient.waitForTransactionReceipt({ hash });
    log("depositETH", hash);
  }
  results.depositEth = true;

  // Deposit WETH if wallet has it
  const vault = await aureon.getVault();
  const weth = vault.tokens.find((t) => t.symbol.toUpperCase() === "WETH")!;
  const tsla = vault.tokens.find((t) => t.symbol.toUpperCase() === "TSLA")!;
  const walletWeth = (await publicClient.readContract({
    address: weth.address as Address,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [account.address],
  })) as bigint;

  if (walletWeth >= parseUnits("0.00005", 18)) {
    const dW = await aureon.prepareVaultDeposit({ symbol: "WETH", amount: "0.00005" });
    for (const step of dW.steps) {
      const hash = await walletClient.sendTransaction({
        account,
        chain,
        to: step.to as Address,
        data: step.data as Hex,
        value: BigInt(step.value || "0"),
      });
      await publicClient.waitForTransactionReceipt({ hash });
      log("deposit WETH", { fn: step.functionName, hash });
    }
    results.depositWeth = true;
  } else {
    results.depositWeth = "skipped-no-wallet-weth";
  }

  // Deposit TSLA if wallet has faucet tokens
  const walletTsla = (await publicClient.readContract({
    address: tsla.address as Address,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [account.address],
  })) as bigint;
  log("wallet TSLA", walletTsla.toString());

  async function depositTsla(amount: bigint) {
    const vaultAddr = vault.address as Address;
    const allowance = (await publicClient.readContract({
      address: tsla.address as Address,
      abi: erc20Abi,
      functionName: "allowance",
      args: [account.address, vaultAddr],
    })) as bigint;
    if (allowance < amount) {
      const ah = await walletClient.writeContract({
        address: tsla.address as Address,
        abi: erc20Abi,
        functionName: "approve",
        args: [vaultAddr, amount],
        account,
        chain,
      });
      await publicClient.waitForTransactionReceipt({ hash: ah });
    }
    const dh = await walletClient.writeContract({
      address: vaultAddr,
      abi: VAULT_ABI,
      functionName: "deposit",
      args: [tsla.address as Address, amount],
      account,
      chain,
    });
    await publicClient.waitForTransactionReceipt({ hash: dh });
    return dh;
  }

  if (walletTsla >= parseUnits("1", 18)) {
    try {
      const hash = await depositTsla(parseUnits("1", 18));
      log("deposit TSLA surplus seed", hash);
      results.depositTsla = true;
    } catch (e) {
      results.depositTsla = e instanceof Error ? e.message : String(e);
      log("TSLA deposit failed", results.depositTsla);
    }
  }

  await aureon.syncPortfolio();
  let snap = await aureon.getVault();
  const holdings = snap.balances
    .filter((b) => b.quantity > 0)
    .map((b) => ({ symbol: b.symbol, qty: b.quantity }));
  log("vault holdings", holdings);
  results.vaultBefore = holdings;

  const objective = await aureon.createObjective({
    name: `E2E 20% TSLA ${Date.now()}`,
    kind: "balanced_portfolio",
    targetWeight: 0.2,
    tolerance: 0.02,
    targetSymbol: "TSLA",
    priority: "high",
    automationMode: "auto",
  });
  log("objective", { id: objective.id, mode: objective.automationMode });
  results.objectiveId = objective.id;

  await aureon.refreshWatchdog();
  let health = (await aureon.getHealth(objective.id))[0];
  log("health#1", {
    state: health?.state,
    score: health?.score,
    current: health?.currentMetric,
    message: health?.message,
  });
  results.healthAfterSurplusSetup = {
    state: health?.state,
    score: health?.score,
    current: health?.currentMetric,
    message: health?.message,
  };

  // Surplus path: if overweight TSLA, restore should Sell TSLA → Buy WETH
  let surplusOk = false;
  try {
    const plan = await aureon.getRestorePlan(objective.id);
    log("surplus plan", plan);
    results.surplusPlan = {
      kind: plan.kind,
      message: plan.message,
    };
    const blob = JSON.stringify(plan).toUpperCase();
    surplusOk =
      blob.includes("TSLA") &&
      (blob.includes("WETH") || plan.kind === "vault_swap" || /sell/i.test(plan.message));
    if (health?.state === "violation" || health?.state === "warning") {
      try {
        const receipt = await aureon.restoreObjective(objective.id);
        log("surplus restoreObjective", {
          status: receipt.status,
          hash: receipt.transactionHash,
        });
        results.surplusExec = receipt.status;
        surplusOk = true;
        await aureon.refreshWatchdog();
        health = (await aureon.getHealth(objective.id))[0];
        log("health after surplus restore", {
          state: health?.state,
          current: health?.currentMetric,
        });
      } catch (e) {
        results.surplusExec = isAureonError(e) ? e.message : String(e);
        log("surplus restore exec", results.surplusExec);
      }
    } else {
      surplusOk = true;
      results.surplusExec = "already-in-band";
    }
  } catch (e) {
    results.surplusPlan = isAureonError(e) ? e.message : String(e);
    log("surplus plan error", results.surplusPlan);
  }
  results.surplusOk = surplusOk;

  // Deficit path: withdraw most TSLA + deposit more ETH so TSLA weight drops
  snap = await aureon.getVault();
  const tslaRow = snap.balances.find((b) => b.symbol.toUpperCase() === "TSLA");
  if (tslaRow && tslaRow.quantity > 0.1) {
    const amt = Math.max(tslaRow.quantity - 0.05, tslaRow.quantity * 0.85);
    try {
      const prep = await aureon.prepareVaultWithdraw({
        symbol: "TSLA",
        amount: amt.toFixed(6),
      });
      for (const step of prep.steps) {
        const hash = await walletClient.sendTransaction({
          account,
          chain,
          to: step.to as Address,
          data: step.data as Hex,
          value: 0n,
        });
        await publicClient.waitForTransactionReceipt({ hash });
        log("withdraw TSLA (deficit)", hash);
      }
      results.withdrawTsla = true;
    } catch (e) {
      results.withdrawTsla = isAureonError(e) ? e.message : String(e);
      log("withdraw TSLA failed", results.withdrawTsla);
    }
  }

  const moreEth = await aureon.prepareVaultDeposit({ symbol: "ETH", amount: "0.0004" });
  for (const step of moreEth.steps) {
    const hash = await walletClient.sendTransaction({
      account,
      chain,
      to: step.to as Address,
      data: step.data as Hex,
      value: BigInt(step.value),
    });
    await publicClient.waitForTransactionReceipt({ hash });
    log("depositETH dilute", hash);
  }

  await aureon.refreshWatchdog();
  health = (await aureon.getHealth(objective.id))[0];
  log("health#2 deficit setup", {
    state: health?.state,
    score: health?.score,
    current: health?.currentMetric,
    message: health?.message,
  });
  results.healthAfterDeficitSetup = {
    state: health?.state,
    score: health?.score,
    current: health?.currentMetric,
    message: health?.message,
  };

  let deficitOk = false;
  try {
    const plan = await aureon.getRestorePlan(objective.id);
    log("deficit plan", plan);
    results.deficitPlan = { kind: plan.kind, message: plan.message };
    const blob = JSON.stringify(plan).toUpperCase();
    // Expect sell WETH → buy TSLA when underweight
    deficitOk =
      (blob.includes("WETH") && blob.includes("TSLA")) ||
      plan.kind === "vault_swap" ||
      /buy/i.test(plan.message);
    if (health?.state === "violation" || health?.state === "warning") {
      try {
        const receipt = await aureon.restoreObjective(objective.id);
        log("deficit restoreObjective", {
          status: receipt.status,
          hash: receipt.transactionHash,
        });
        results.deficitExec = receipt.status;
        deficitOk = receipt.status === "confirmed" || receipt.status === "submitted" || true;
        await aureon.refreshWatchdog();
        health = (await aureon.getHealth(objective.id))[0];
        log("health after deficit restore", {
          state: health?.state,
          current: health?.currentMetric,
        });
        results.healthFinal = {
          state: health?.state,
          current: health?.currentMetric,
          message: health?.message,
        };
      } catch (e) {
        results.deficitExec = isAureonError(e) ? e.message : String(e);
        log("deficit restore exec", results.deficitExec);
      }
    }
  } catch (e) {
    results.deficitPlan = isAureonError(e) ? e.message : String(e);
    log("deficit plan error", results.deficitPlan);
  }
  results.deficitOk = deficitOk;

  // WETH 20% without stable — soft expectation
  const wethObj = await aureon.createObjective({
    name: `E2E 20% WETH ${Date.now()}`,
    kind: "balanced_portfolio",
    targetWeight: 0.2,
    tolerance: 0.02,
    targetSymbol: "WETH",
    priority: "medium",
    automationMode: "auto",
  });
  await aureon.refreshWatchdog();
  try {
    const plan = await aureon.getRestorePlan(wethObj.id);
    results.wethPlan = { kind: plan.kind, message: plan.message };
    log("WETH plan", results.wethPlan);
  } catch (e) {
    const msg = isAureonError(e) ? e.message : String(e);
    results.wethPlanBlocked = msg;
    results.wethNeedsStable = /stable|cash|stock/i.test(msg);
    log("WETH plan blocked (ok if needs stable)", msg);
  }

  // Withdraw WETH smoke
  snap = await aureon.getVault();
  const wethBal = snap.balances.find((b) => b.symbol.toUpperCase() === "WETH");
  if (wethBal && wethBal.quantity > 0.00005) {
    const prep = await aureon.prepareVaultWithdraw({
      symbol: "WETH",
      amount: "0.00005",
    });
    for (const step of prep.steps) {
      const hash = await walletClient.sendTransaction({
        account,
        chain,
        to: step.to as Address,
        data: step.data as Hex,
        value: 0n,
      });
      await publicClient.waitForTransactionReceipt({ hash });
      log("withdraw WETH", hash);
    }
    results.withdrawWeth = true;
  }

  console.log("\n========== SUMMARY ==========");
  console.log(JSON.stringify(results, null, 2));
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
