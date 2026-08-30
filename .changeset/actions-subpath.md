---
'@initlabs/vibekit': minor
---

`@initlabs/vibekit/actions`: the record envelope, stage events, action reducer, host controller, and wallet signing move from the explorer into the published package, browser-safe. The explorer keeps its view models (the action view model is now `views/action.ts`) and re-exports the moved names, so app imports keep working. `EXPLORER_PROTOCOL_VERSION` → `RECORD_PROTOCOL_VERSION`.
