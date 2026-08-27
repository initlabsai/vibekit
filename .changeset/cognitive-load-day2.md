---
'@initlabs/vibekit': minor
---

`@initlabs/vibekit/tools` now exports only what consumers use: the tool arrays, the ARC-56 toolkit (`normalizeAppSpec`, `toolsFromArc56`, `toolsWithMethods`, `toolArgsFor`, `enrichTransactionsWithAbi`, `labelSelectors`, `programHash`, `estimateProgramTokens`, `DEPLOYER_NOTE_PREFIX`), `txnSpecSchema`, the transaction wire schemas, and `viewDataSchemas`. The per-domain lookup functions and app-spec internals are no longer re-exported.
