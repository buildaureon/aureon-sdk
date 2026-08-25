# Receipt validation

Phase 2 receipts must follow honest settlement rules. Use the SDK validator after every restore or when ingesting receipts from logs.

---

## Quick example

```ts
import {
  createAureonClient,
  validateExecutionReceipt,
  assertValidExecutionReceipt,
} from "@buildaureon/sdk";

const client = createAureonClient({
  baseUrl: process.env.AUREON_API_URL!,
  apiKey: process.env.AUREON_API_KEY!,
});

const receipt = await client.restoreObjective("obj_abc123");

const check = validateExecutionReceipt(receipt);
if (!check.valid) {
  for (const issue of check.issues) {
    console.error(issue.code, issue.path, issue.message);
  }
  throw new Error("Receipt failed validation");
}

// Or throw in one step:
assertValidExecutionReceipt(receipt);
```

List recent receipts and validate each:

```ts
for (const receipt of await client.listExecutions()) {
  assertValidExecutionReceipt(receipt);
}
```

---

## What gets checked

| Rule | Fail code (examples) |
|------|----------------------|
| Required fields present | `MISSING_FIELD` |
| `settlement` is `vault` or `staged` | `INVALID_SETTLEMENT` |
| Staged: no explorer, not verified | `STAGED_WITH_EXPLORER`, `STAGED_VERIFIED_ON_CHAIN` |
| Vault with real `0x` tx: explorer required | `VAULT_MISSING_EXPLORER` |
| `verifiedOnChain: true` needs matching record | `VERIFIED_WITHOUT_RECORD` |
| Registry ref hex shape | `INVALID_REGISTRY_REF` |

The validator does **not** re-query the chain — it checks shape and honesty only.

---

## Related

- [Data contracts](./data-contracts.md) — receipt and settlement fields
- [Integration guide](./integration-guide.md) — agent restore loop
