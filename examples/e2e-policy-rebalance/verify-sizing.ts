/**
 * Verify underweight Automatic sizing lands near 20% (not a blow-up fill).
 *
 * Env:
 *   AUREON_API_KEY            issued developer key
 *   AUREON_WALLET_PRIVATE_KEY 0x… signing key
 *   AUREON_API_URL            optional (default https://api.aureonlabs.network)
 *   AUREON_RPC_URL            optional
 *   AUREON_CHAIN_ID           optional (default 46630)
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  createAureonClient,
  createSessionTokenProvider,
  DEFAULT_API_BASE_URL,
} from "../../src/index.js";

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Set ${name}`);
  return value;
}

const key = requireEnv("AUREON_WALLET_PRIVATE_KEY") as Hex;
if (!/^0x[0-9a-fA-F]{64}$/.test(key)) {
  throw new Error("AUREON_WALLET_PRIVATE_KEY must be a 0x-prefixed 32-byte hex key");
}

const account = privateKeyToAccount(key);
const rpc =
  process.env.AUREON_RPC_URL?.trim() ||
  "https://rpc.testnet.chain.robinhood.com";
const chainId = Number(process.env.AUREON_CHAIN_ID || 46630);
const publicClient = createPublicClient({ transport: http(rpc) });
const walletClient = createWalletClient({ account, transport: http(rpc) });
const chain = {
  id: chainId,
  name: "Robinhood Chain Testnet",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [rpc] } },
} as const;

const session = createSessionTokenProvider(null);
const aureon = createAureonClient({
  baseUrl: process.env.AUREON_API_URL?.trim() || DEFAULT_API_BASE_URL,
  apiKey: requireEnv("AUREON_API_KEY"),
  getAccessToken: session.getAccessToken,
});

const { message } = await aureon.getAuthNonce(account.address);
session.setToken(
  (
    await aureon.verifyWallet({
      address: account.address,
      message,
      signature: await walletClient.signMessage({ account, message }),
    })
  ).token
);

const objective = await aureon.createObjective({
  name: `SizeFix 20% TSLA ${Date.now()}`,
  kind: "balanced_portfolio",
  targetWeight: 0.2,
  tolerance: 0.05,
  targetSymbol: "TSLA",
  priority: "high",
  automationMode: "auto",
});
console.log("objective", objective.id);

const vault = await aureon.getVault();
console.log(
  "before",
  vault.balances.filter((b) => b.quantity > 0).map((b) => `${b.symbol}:${b.quantity}`)
);
const tsla = vault.balances.find((b) => b.symbol.toUpperCase() === "TSLA");
if (tsla && tsla.quantity > 0.0001) {
  const amt = Math.max(tsla.quantity - 0.00001, 0).toFixed(8);
  const prep = await aureon.prepareVaultWithdraw({ symbol: "TSLA", amount: amt });
  for (const step of prep.steps) {
    const hash = await walletClient.sendTransaction({
      account,
      chain,
      to: step.to as Address,
      data: step.data as Hex,
      value: 0n,
    });
    await publicClient.waitForTransactionReceipt({ hash });
    console.log("withdrew TSLA", hash);
  }
}

const dep = await aureon.prepareVaultDeposit({ symbol: "ETH", amount: "0.0004" });
for (const step of dep.steps) {
  const hash = await walletClient.sendTransaction({
    account,
    chain,
    to: step.to as Address,
    data: step.data as Hex,
    value: BigInt(step.value),
  });
  await publicClient.waitForTransactionReceipt({ hash });
  console.log("depositETH", hash);
}

await aureon.refreshWatchdog();
const h1 = (await aureon.getHealth(objective.id))[0]!;
console.log("health underweight", {
  state: h1.state,
  current: h1.currentMetric,
  message: h1.message,
});

const plan = await aureon.getRestorePlan(objective.id);
console.log("plan", {
  message: plan.message,
  amountHuman: plan.amountHuman,
  approxUsd: plan.approxUsd,
  sell: (plan as { sellSymbol?: string }).sellSymbol,
  buy: (plan as { buySymbol?: string }).buySymbol,
});

const receipt = await aureon.restoreObjective(objective.id);
console.log("exec", receipt.status, receipt.transactionHash);

await aureon.refreshWatchdog();
const h2 = (await aureon.getHealth(objective.id))[0]!;
console.log("health after", {
  state: h2.state,
  current: h2.currentMetric,
  message: h2.message,
});

const weightPct = (h2.currentMetric ?? 0) * 100;
const ok = weightPct >= 5 && weightPct <= 45;
console.log(
  ok
    ? `PASS sizing : TSLA weight ~${weightPct.toFixed(1)}% (want ~20%)`
    : `FAIL sizing : TSLA weight ~${weightPct.toFixed(1)}% still overshot`
);
if (!ok) process.exitCode = 1;
