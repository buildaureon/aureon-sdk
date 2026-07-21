/**
 * Follow-up: force TSLA underweight → Auto should Sell WETH → Buy TSLA.
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
  isAureonError,
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
const signature = await walletClient.signMessage({ account, message });
session.setToken(
  (
    await aureon.verifyWallet({
      address: account.address,
      message,
      signature,
    })
  ).token
);

const vault = await aureon.getVault();
const tsla = vault.balances.find((b) => b.symbol.toUpperCase() === "TSLA");
console.log(
  "vault before underrun",
  vault.balances.filter((b) => b.quantity > 0).map((b) => ({ s: b.symbol, q: b.quantity }))
);

if (tsla && tsla.quantity > 0.001) {
  const amt = (tsla.quantity - 0.000001).toFixed(8);
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
    console.log("withdrew almost all TSLA", hash);
  }
}

const d = await aureon.prepareVaultDeposit({ symbol: "ETH", amount: "0.0005" });
for (const step of d.steps) {
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

const objs = await aureon.listObjectives();
const obj = objs.find((o) => o.name.includes("E2E 20% TSLA")) ?? objs[0];
if (!obj) throw new Error("no objective");
console.log("using objective", obj.id, obj.name);

await aureon.refreshWatchdog();
const h = (await aureon.getHealth(obj.id))[0]!;
console.log("health", {
  state: h.state,
  current: h.currentMetric,
  message: h.message,
});

try {
  const plan = await aureon.getRestorePlan(obj.id);
  console.log("UNDERRUN PLAN", plan.message, {
    kind: plan.kind,
    sell: (plan as { sellSymbol?: string }).sellSymbol,
    buy: (plan as { buySymbol?: string }).buySymbol,
  });
  const receipt = await aureon.restoreObjective(obj.id);
  console.log("UNDERRUN EXEC", receipt.status, receipt.transactionHash);
  await aureon.refreshWatchdog();
  const h2 = (await aureon.getHealth(obj.id))[0]!;
  console.log("health after buy", {
    state: h2.state,
    current: h2.currentMetric,
    message: h2.message,
  });
} catch (e) {
  console.log("plan/exec", isAureonError(e) ? e.message : e);
}
