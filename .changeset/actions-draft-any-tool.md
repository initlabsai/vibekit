---
'@initlabs/vibekit-explorer': minor
---

`ActionHost.draft(toolName, args)` replaces `draftPayment(params)`: any action tool drafts through the same machine, and the live host refuses queries. `startAction` takes `draft: { toolName, args }`. Wallet signing moves into the explorer as `createWalletSignDraft` / `signGroupForDraft` / `unsignedTransactionsForDraft` (browser-safe), with a `record` transport instead of a baked-in fetch.
