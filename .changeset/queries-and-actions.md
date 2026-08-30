---
'@initlabs/vibekit': minor
'@initlabs/vibekit-explorer': minor
---

Tools are queries or actions. `assetTools` → `assetQueries`, `assetWriteTools` → `assetActions` (same for accounts, transactions, contracts, network); the preset adds `defaultQueries` and `defaultActions` beside `defaultTools`. Core adds `isAction`, `defineQuery`, `defineAction`, and `output` is now required on every tool. The explorer's write flow is the action machine: `WriteFlow*` → `Action*`, `startWriteFlow` → `startAction`, `completeApprovedWriteFlow` → `submitAction`, `src/flows` → `src/actions`.
