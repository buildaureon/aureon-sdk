/**
 * @fileoverview Console demo of an Automatic SDK loop against the live API.
 *
 * Env:
 *   AUREON_API_KEY  issued developer key (required)
 *   AUREON_API_URL  optional (default https://api.aureonlabs.network)
 *
 *   pnpm --filter @buildaureon/sdk example:sdk-demo-terminal
 *   pnpm --filter @buildaureon/sdk example:sdk-demo-terminal -- --create-only
 */

import {
  createAureonClient,
  DEFAULT_API_BASE_URL,
  formatWeight,
  isAureonError,
  type PortfolioPositionInput,
} from "../../src/index.js";

const CREATE_ONLY = process.argv.includes("--create-only");

const DEMO_POSITIONS: PortfolioPositionInput[] = [
  {
    symbol: "USDG",
    name: "Paxos USDG",
    category: "stable",
    quantity: 24_000,
    markPriceUsd: 1,
  },
  {
    symbol: "NVDA",
    name: "NVIDIA Stock Token",
    category: "stock_token",
    quantity: 45,
    markPriceUsd: 920,
  },
  {
    symbol: "AAPL",
    name: "Apple Stock Token",
    category: "stock_token",
    quantity: 80,
    markPriceUsd: 210,
  },
  {
    symbol: "GOOGL",
    name: "Alphabet Stock Token",
    category: "stock_token",
    quantity: 60,
    markPriceUsd: 175,
  },
  {
    symbol: "ETH",
    name: "Ether",
    category: "gas",
    quantity: 8.5,
    markPriceUsd: 3400,
  },
];

function shortHash(hash: string, head = 10, tail = 6): string {
  if (hash.length <= head + tail + 1) return hash;
  return `${hash.slice(0, head)}…${hash.slice(-tail)}`;
}

function line(kind: "cmd" | "out" | "err" | "meta", text: string): void {
  const prefix =
    kind === "cmd" ? "$ " : kind === "err" ? "! " : kind === "meta" ? "# " : "  ";
  console.log(`${prefix}${text}`);
}

async function main(): Promise<void> {
  const apiKey = process.env.AUREON_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("Set AUREON_API_KEY to an issued developer key.");
  }

  const baseUrl = process.env.AUREON_API_URL?.trim() || DEFAULT_API_BASE_URL;
  line(
    "meta",
    CREATE_ONLY
      ? `@buildaureon/sdk · create-only · ${baseUrl}`
      : `@buildaureon/sdk · Automatic demo loop · ${baseUrl}`
  );

  const aureon = createAureonClient({ baseUrl, apiKey });

  line("cmd", "aureon.ping()");
  const ping = await aureon.ping();
  line(
    "out",
    `connected  ok=${String(ping.ok)}  service=${ping.service}  version=${ping.version}`
  );

  line("cmd", "aureon.me()");
  const me = await aureon.me();
  line("out", `me       wallet=${me.walletAddress}`);

  line("cmd", "aureon.setPortfolio(/* rehearsal book */)");
  const book = await aureon.setPortfolio(DEMO_POSITIONS);
  line(
    "out",
    `portfolio  notional=${book.totalNotionalUsd.toFixed(0)}  stable=${formatWeight(book.stableWeight)}  positions=${book.positions.length}`
  );

  line(
    "cmd",
    'aureon.createObjective({ kind: "stable_allocation", targetWeight: 0.2, … })'
  );
  const objective = await aureon.createObjective({
    name: "Maintain 20% Stable Assets",
    kind: "stable_allocation",
    targetWeight: 0.2,
    tolerance: 0.02,
    priority: "high",
  });
  line(
    "out",
    `objective  id=${objective.id}  status=${objective.status}  mode=${objective.automationMode}`
  );

  if (CREATE_ONLY) {
    line("meta", "create-only complete");
    return;
  }

  line(
    "cmd",
    'aureon.applyMarketEvent({ symbol: "NVDA", priceChangeRatio: 0.45, autoRestore: true })'
  );
  const market = await aureon.applyMarketEvent({
    name: "NVDA Stock Token Rally",
    description: "Controlled mark appreciation on NVIDIA Stock Token",
    symbol: "NVDA",
    priceChangeRatio: 0.45,
    autoRestore: true,
  });
  line(
    "out",
    `market     event=${market.event.id}  ${market.event.symbol} ${(market.event.priceChangeRatio * 100).toFixed(0)}%`
  );

  const executions =
    market.executions.length > 0
      ? market.executions
      : await aureon.listExecutions(objective.id);
  for (const receipt of executions) {
    line(
      "out",
      `execution  id=${receipt.id}  status=${receipt.status}  settlement=${receipt.settlement ?? "n/a"}  hash=${shortHash(receipt.transactionHash)}`
    );
  }

  const finalHealth = (await aureon.getHealth(objective.id))[0];
  if (finalHealth) {
    line(
      "out",
      `health     state=${finalHealth.state}  current=${formatWeight(finalHealth.currentMetric)}  target=${formatWeight(finalHealth.targetMetric)}`
    );
  }

  line("meta", "done — check settlement field before claiming on-chain");
}

main().catch((error) => {
  if (isAureonError(error)) {
    line("err", `${error.code}: ${error.message}`);
  } else {
    line("err", error instanceof Error ? error.message : String(error));
  }
  process.exitCode = 1;
});
