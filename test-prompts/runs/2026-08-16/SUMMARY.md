# Run 2026-08-16 — full localnet suite, headless Sonnet runners

Harness: one fresh `claude -p --model sonnet` session per prompt file,
vibekit-only `--mcp-config`, allowlist scoped to the vibekit MCP server + the
compiled binary. Orchestrated phase-by-phase (addresses threaded via context
headers); compose ran as two sessions (multi-network compose, then
single-network). Engine: compiled binary at commit `d8c41d4` (+ the
read_local_state fix landed mid-run, binary rebuilt before the accounts phase).

## Scorecard

| Phase | Total | Pass | Fail | Warn | Skip |
|---|---|---|---|---|---|
| network | 7 | 6 | 0 | 1 | 0 |
| keystore | 5 | 5 | 0 | 0 | 0 |
| transactions | 10 | 10 | 0 | 0 | 0 |
| assets | 17 | 17 | 0 | 2* | 0 |
| contracts | 19 | 18 | **1** | 0 | 0 |
| accounts | 10 | 9 | 0 | 1 | 0 |
| gates | 14 | 12 | 0 | 1† | 1 |
| compose A | 11 | 11 | 0 | 0 | 0 |
| compose B | 4 | 4 | 0 | 0 | 0 |
| **Total** | **97** | **92** | **1** | **5** | **1** |

\* reported alongside PASSes. † resolved out-of-band (see below).

**Zero `OUTPUT_MISMATCH` across ~200 live tool calls** — the enforced output
schemas hold against real chain data.

## The FAIL (fixed same day)

- `read_local_state` on a **never-opted-in** account propagated algod's raw
  404 instead of `optedIn: false` (closed-out accounts worked — algod 404s
  only accounts it never saw opt in). Fixed in
  `packages/tools-contracts/src/handlers/state.ts` + regression unit test.

## WARNs → follow-up candidates (pre-1.0 polish)

1. `create_asset` result surfaces no created asset ID — runner had to recover
   it via `search_assets`. `app_deploy` fetches pending-txn info for `appId`;
   `create_asset` should do the same with `assetIndex`.
2. `search_asset_balances.amount` is a locale-formatted decimal-shifted string
   (`"9,995"`) while `get_asset_info`/`lookup_asset` report raw units —
   inconsistent and ambiguous on the wire (known from the schema audit, now
   confirmed from the consumer seat).
3. Failed-simulation `failureMessage` embeds a raw algod Go-struct dump —
   functional but noisy; worth truncating/cleaning.
4. `lookup_account` on a never-used address returns a raw indexer 404
   passthrough vs. the tool's own clean error style elsewhere.
5. `search_block_headers.transactionCount` is always 0 (headers carry no
   transactions) — confirmed wrong against live data; drop or fix the field.
6. (Resolved) gates step 13 — the runner's client couldn't see MCP
   annotations; verified via raw `tools/list`: 53 tools, all write tools
   `readOnlyHint:false` + `destructiveHint:true`, all reads `readOnlyHint:true`,
   zero violations.

## SKIP

- gates step 10 (ABI-embedded acfg guard) — needs the deferred richer fixture
  app with a transaction-typed ABI arg. Guard verified at the unit level only.

## Notable positives

- Keystore label round-trip, signing without key exposure, and the funded
  balance checks all held live.
- Every gate refused with the documented code; explicit `false` is not
  treated as consent; balance invariants exact to the µALGO across the
  gates and compose phases.
- Compose summaries carry the `CLOSE ACCOUNT` warning text; keystore tools
  correctly absent from signer-less deployments; single-network deployments
  inject no `network` param and ignore a stray one cleanly.
