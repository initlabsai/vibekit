---
'@initlabs/vibekit': minor
'@initlabs/vibekit-explorer': minor
---

`createAgentHandler` in `@initlabs/vibekit/agent`: the agent as a web-standard HTTP handler — one POST per turn, NDJSON events back, composed groups leaving as `draft` records. The model, tools, prompt, per-turn caps, and billing are options; nothing reads the environment. Draft decoding (`decodeUnsignedGroup`, `draftRecordFromComposeWire`, the algod transaction formatter) and `activeSenderLine` move into the package; the explorer re-exports them.
