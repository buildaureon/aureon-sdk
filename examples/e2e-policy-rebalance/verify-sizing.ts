/**
 * Verify underweight Auto sizing lands near 20% (not 98%).
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
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
  LOCAL_API_BASE_URL,
} from "../../src/index.js";

const BACKEND = join(dirname(fileURLToPath(import.meta.url)), "../../../backend");
const env = Object.fromEntries(
  readFileSync(join(BACKEND, ".env"), "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1).trim()] as const;
    })
);
const key = JSON.parse(
  readFileSync(join(BACKEND, ".secrets/robinhood-testnet-wallet.json"), "utf8")
).privateKey as Hex;
const account = privateKeyToAccount(key);
const rpc = env.AUREON_RPC_URL!;
const chainId = Number(env.AUREON_CHAIN_ID || 46630);
const publicClient = createPublicClient({ transport: http(rpc) });
const walletClient = createWalletClient({ account, transport: http(rpc) });
const chain = {
  id: chainId,
  name: "rh",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [rpc] } },
} as const;

const session = createSessionTokenProvider(null);
const aureon = createAureonClient({
  baseUrl: LOCAL_API_BASE_URL,
  apiKey: env.AUREON_API_KEYS!.split(",")[0]!.trim(),
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

// Fresh Auto objective
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

// Dump almost all TSLA so we're heavily underweight, keep/add WETH
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
const ok = weightPct >= 5 && weightPct <= 45; // near 20% with band (was ~98% before)
console.log(
  ok
    ? `PASS sizing : TSLA weight ~${weightPct.toFixed(1)}% (want ~20%)`
    : `FAIL sizing : TSLA weight ~${weightPct.toFixed(1)}% still overshot`
);
if (!ok) process.exitCode = 1;
