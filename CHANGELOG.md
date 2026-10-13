# Changelog

Dates are the npm publish day, except `0.1.16`, which is this tree and is not on npm yet. The API `/healthz` field `version` is the API. It is not this package version.

## 0.1.16 — 2026-10-12

Hire check and restoration confirm. `@buildaureon/sdk` `0.1.16`, `@buildaureon/mcp` `0.1.16`, and hosted MCP `0.1.16` move together.

npm still serves `0.1.15`, published 2026-10-06. Publish this SDK before `@buildaureon/mcp@0.1.16`. The MCP package depends on `@buildaureon/sdk@0.1.16`.

### Hire check

`checkPolicy` reads one financial objective and stores `allow`, `refuse`, or `authorization_required`. `getPolicyCheck` reads that stored decision by `actionId`. Create accepts `hireLimitEth` and `hireApprovalRequired`.

The cap stays `hireLimitEth`.

- An ETH amount is compared with that cap directly.
- A SOL amount is priced as an ETH equivalent before the same comparison: `SOL × (SOL_USD / ETH_USD)`, rounded up with `(sol × solUsd + ethUsd − 1) / ethUsd` so truncation cannot slip under the cap. The marks come from the live USD feed. A missing SOL price stores `refuse` with "SOL price is unavailable." A missing ETH price stores `refuse` with "ETH price is unavailable." The check does not invent a rate.
- Any other asset stores `refuse`: "Only ETH, or SOL as an ETH equivalent, can be hired."
- Equal to the cap is inside. The allow reason for ETH is "Hire is inside the ETH limit." The allow reason for SOL is "SOL equivalent is inside the ETH hire limit."
- Above the cap is `refuse`, including when approval is also required. The SOL reason is "SOL equivalent is above the ETH hire limit."
- Inside the cap with `hireApprovalRequired` is `authorization_required`, and `policy.passed` is false.
- A missing objective is not stored.

The SDK sends the asset string. The API does the conversion. The check does not pay, does not sign, and does not send. SOL in this check is that asset symbol. The call does not build a Solana transaction.

`0.1.15` had no hire check.

### Restoration

`proposeRestoration` remains the unsigned sleeve and reserve proposal from `0.1.15`. The sleeve step sells `profitTakeRatio` of the notional above a ceiling. The reserve step runs only when stables are still under the floor after that slice. `transactionHash` and `sentBy` stay null. Both objectives are `manual`. `weightBound` is `ceiling`, `floor`, or `target`.

`confirmRestoration(objectiveId, transactionHash)` is new. It stores a vault rebalance the session wallet already broadcast. The API checks the receipt: the transaction succeeded, the sender is the session wallet, `to` is the vault, and the calldata is the rebalance. It then stores a confirmed execution. This method does not sign and does not broadcast.

`restoreObjective` and `runExecution` are different calls. On an `auto` objective the keeper can still send before the steps are checked. `confirmExecutionSettlement` confirms settlement on an existing execution. It is a separate method from `confirmRestoration`.

### Versions

This package is `0.1.16`. The API `/healthz` field `version` in this tree is `0.2.2`. The private backend package version stays `0.1.0`.

## 0.1.15 — 2026-10-06

Unsigned restoration. Published to npm on this day. `@buildaureon/mcp@0.1.15` was published the same day and depends on this SDK.

### What this version added

`proposeRestoration` takes the sleeve objective id and the reserve objective id. It sizes unsigned `rebalance` steps from vault balances.

- The sleeve step sells `profitTakeRatio` of the notional above a ceiling. The usual objective uses `0.25`, which is 25% of the amount above the cap, not a full return to the cap.
- The reserve step runs only when stables are still under the floor after that slice.
- `weightBound` is `ceiling`, `floor`, or `target`. A sleeve uses `ceiling`. A reserve uses `floor`.
- `transactionHash` and `sentBy` stay null. The method does not sign and does not broadcast.
- `automationMode: "auto"` is rejected. On an auto objective the keeper can send before the steps are checked.

Create and update accept `weightBound`, `profitTakeRatio`, and `targetSymbol`. The target symbol is kept.

### What this version did not include

No `checkPolicy`. No `confirmRestoration`. No SOL amount priced as ETH. Those are `0.1.16`.

## 0.1.14 — 2026-10-03

Financial history. Published to npm on this day. SDK, MCP, and hosted MCP moved together. The API health field `version` at this release was `0.2.1`.

### What this version added

Decision records, portfolio history, health history, and wallet-signed reports.

- `listDecisions` and `getDecision` read stored decisions.
- `getPortfolioHistory` reads daily book totals already stored for the wallet.
- `getHealthHistory` reads stored health scores.
- `prepareReport` builds a report. `confirmReport` stores the wallet signature. It does not broadcast. `verified` is true only when the signature recovers to the session wallet.
- `listReports` and `getReport` read those stored reports.
- `listTimeline` accepts `before` and `limit`.

