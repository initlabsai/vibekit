# Handover — VibeKit v2 Dev Stack

Status: **Phases 0–6 complete · adversarial review IMPLEMENTED · holding at the 1.0 publish gate**
Owner: Gabriel Kuettel · Init Labs LLC · Last updated: 2026-08-16

This document is the operational handover: what exists, how to verify it, what
environment it assumes, and what happens next. The *design* rationale lives in
[DESIGN.md](./DESIGN.md) (canonical; §6 and §10 are normative); the
constitution is [CONSTITUTION.md](./CONSTITUTION.md). The adversarial
review runs from [REVIEW-BRIEF.md](./REVIEW-BRIEF.md). A visual map is
[architecture.html](./architecture.html).

## What exists

| Layer | Contents | Where |
|---|---|---|
| Contract + core | `defineTool`, `resolveDeployment`/`executeToolCall`, compose engine, codecs, network clients | `packages/core` |
| Tools | 5 domains (network, accounts, assets, transactions, contracts), ~46 tools | `packages/tools-*` |
| Plugins | nfd, alpha-arcade (prove the plugin contract) | `packages/plugin-*` |
| Custody | signer (keystore daemon RPC), account lifecycle tools, sealed secrets, TestNet dispenser | `packages/signer-keystore` |
| Orchestrator | AI SDK v7 loop, BYOM, AgentEvent protocol, approveToolCall | `packages/agent` |
| MCP server | stdio + stateless HTTP (2026-07-28 spec, legacy-bridged), one adapter | `packages/mcp` |
| CLI | `new · init · localnet · keystore · dispenser · tool · mcp · doctor · agent` | `apps/cli` (bun-compiled binary) |
| Reference deployment | ~25-line self-hosting example | `apps/mcp` |
| Knowledge | canonical skills (`use-vibekit`, `vibekit-project-setup`), AGENTS.md template | `skills/`, `apps/cli/src/config/agents-md.ts` |

## How to verify (from a clean checkout)

```bash
bun install
bunx turbo run build typecheck test      # ~181 tests, all workspaces green
cd apps/cli && bun run build             # compiles bin/vibekit (~95 MB)
./bin/vibekit doctor                     # environment diagnosis
```

Live loop (requires Docker):

```bash
./bin/vibekit localnet start
./bin/vibekit keystore serve &           # auto-provisions pinned keystore-node
./bin/vibekit tool create_signing_account '{"name":"smoke"}'
./bin/vibekit localnet fund <address-from-above>
./bin/vibekit tool send_payment '{"sender":"<addr>","receiver":"<addr>","amountMicroAlgos":1000,"network":"localnet"}'
```

## Environment assumptions (⚠ verified on ONE machine: Arch Linux, mise, GNOME keychain)

- **bun** ≥ 1.3 (workspace + compile), **node/npm** on PATH (template projects + keystore provisioning).
- **Docker** with compose v2 (localnet).
- OS keychain reachable (Secret Service / macOS Keychain) — keystore-node's storage.
- Pinned pre-1.0 deps: `algosdk@3.7.0-beta.1`, `keystore-node@1.0.0-canary.3` (pin-exact policy; the npm `latest` tag of keystore-node points at a stale beta — never install unpinned).
- macOS and Windows are **entirely unverified** (paths, sockets, keychain, `npm --prefix` provisioning).

## Architecture in one screen (read before touching code)

**One `ToolDefinition` (`defineTool`), three hosts** (MCP adapter, `createAgent`,
`vibekit tool`), all funneling through the shared path:
`resolveDeployment` → `injectNetworkParam` → host parses args → `executeToolCall`
→ `jsonSafe(handler)`. Writes go `composeOrExecute` → `buildGroup` → `finishGroup`.

`executeToolCall` (`packages/core/src/deployment.ts`) is **the** enforcement point —
network-on-writes, context selection, jsonSafe. A host that skips schema parsing
(future Hono API) is still guarded there.

Write-gating flags on a tool (`packages/core/src/contract.ts`):
- `requiresSigner` — chain write from user funds; forces explicit `network`, gated.
- `mutatesState` — world-changing but not a fund-spend (create key, faucet); gated, no forced network.
- Either → MCP `readOnlyHint:false` + `destructiveHint:true`; agent `approveToolCall` fires.

Keys never enter the CLI process on the default path (`extractable:false`); the signer
only calls `keystore.sign(id, txn.bytesToSign())`. No databases. Custody + credentials
behind the keystore daemon (§6). Network/sender explicit per request; conversation is
the only session memory (§10). Localnet is regenerable Docker config; skills are repo
content bundled at build.

Init MCP env: `NETWORK=localnet`, `NETWORKS=localnet,testnet,mainnet`, `SIGNING=execute`.
CLI MCP falls back to compose (loud stderr) if the daemon is down. Reference `apps/mcp`
HTTP is compose-only.

## Adversarial review — IMPLEMENTED (commits 5d30d0d, 06f6ab6)

Security-relevant fixes and where they live:

- **Network enforced in the core**, not just the schema — `executeToolCall` throws
  `NETWORK_REQUIRED` on `requiresSigner` tools missing explicit network (`deployment.ts` ~159).
- **Close-account confirmation** — `closeRemainderTo`/`closeAssetTo` throw
  `CLOSE_NOT_CONFIRMED` unless `confirmCloseAccount:true` (`compose/build.ts` `requireCloseConfirmation`).
- **Permanent role-clearing guarded** — `asset_config` AND acfg-embedded-in-ABI-args keep
  `strictEmptyAddressChecking` unless `confirmClearRoles:true` (`build.ts` top-level + `buildTransactionArg`).
- **All address fields validated** incl. ABI transaction-typed args (`requireAddress`/`optionalAddress`).
- **Private-key hygiene** — address book prefers state public keys; drops any exported
  `privateKey` immediately (`signer-keystore/src/index.ts` ~77).
- **`socketPath` was silently ignored** — client option is `path`, fixed (`index.ts` ~168).
- **Dispenser** uses `mutatesState`, enforces testnet (`WRONG_NETWORK`), single-flights refresh (`dispenser.ts`).
- **Untrusted on-chain content** — NFD avatar URLs must be https; note decode uses printable
  heuristic (old catch was dead code); system-prompt data-not-instructions line.
- **Skills**: shell `vibekit tool` is READ-ONLY for agents; writes via MCP where the gate applies.

**Trust boundary (normative):** local stack = trusted machine, competent developer;
same-UID daemon access is the ssh-agent posture (accepted, documented). The **model** is
not trusted (prompt injection via chain data) — hence write gates, close/clear
confirmations, on-chain-strings-as-data. **Phase 7 (hosted, untrusted browsers) gets NONE
of these relaxations.**

## Known gaps (deliberate, tracked)

- **Rekeyed accounts**: signer resolves address→key 1:1; a rekeyed account would sign
  with the wrong key (chain rejects — safe but broken). Pre-1.0 correctness item.
- **Multisig**: unsupported. Post-1.0.
- ~~**`output` schemas unenforced**~~ — RESOLVED 2026-08-16 (owner chose **enforce**):
  `executeToolCall` now validates every result against `tool.output` post-`jsonSafe`
  (`OUTPUT_MISMATCH` on violation; validation-only, no stripping). All 39 schemas were
  audited against wire reality and fixed — notably: inner txns carry no indexer `id`
  (was a hard failure on every DeFi lookup), uint64 fields no longer pre-`Number()`ed
  (silent precision loss above 2^53), zod-4 `z.unknown()` fields made `.nullish()`,
  NFD empty-object results, dispenser response drift. Regression tests round-trip
  realistic indexer payloads through `jsonSafe` + schema per package. Follow-up
  opportunity: publish MCP `outputSchema`/`structuredContent` from the now-true schemas.
- **Distribution**: no install channel for the binary; blocked on the 1.0 gate.
- **CI**: unit suites run, but nothing exercises the compiled binary (where the
  `$bunfs` bug class lives) or non-Linux platforms.
- Small debts: AGENTS.md skills table is hand-maintained (should generate from the
  bundle); `withKeystoreTools`/deployment construction duplicated across
  `apps/cli/src/commands/{mcp,tool}.ts`.
- **App-call tools expose no box references parameter** — an app call touching
  boxes can't declare them, so box-using contracts fail at runtime (simulate's
  `allowUnnamedResources` is the only escape). Tool-surface gap, pre-1.0 worth
  deciding.
- **Test prompts** (`test-prompts/`): cover the tool surface, gates, compose
  mode, single-network, and bootstrap; deliberately deferred: ABI depth (method
  args, return-value decoding, `deployTimeParams`, txn-typed args — needs a
  richer fixture app with an ARC-4 router), stateless-HTTP transport, and the
  `vibekit tool` CLI host (better served by deterministic CI than prompts).
- Vendored language skills removed pending vibekit-consistent refactor (git history
  keeps them; `skills/README.md` explains).

## Heritage

v1 lives at `github.com/gabrielkuettel/vibekit` (`~/Code/vibekit`) — legacy, kept
runnable until cutover, **no longer the home of any current documentation**. Its
lessons are encoded in DESIGN.md §13 ("what dies from v1"). The 0.x release remains
what users have installed; `vibekit doctor --fix` migrates their machines.

## Next

1. **Adversarial review** — done + Do-now items implemented 2026-08-16
   ([REVIEW-FINDINGS.md](./REVIEW-FINDINGS.md), brief was [REVIEW-BRIEF.md](./REVIEW-BRIEF.md)).
   Phase-7 items remain open there. Don't re-run the brief unless the tree moved.
2. **1.0 publish gate** — remaining owner decisions: license (Q11),
   algosdk pin-vs-peer (Q9) (`output` enforce-or-drop resolved: enforced, see Known
   gaps). Then npm publish (`@initlabs` scope registered), install
   channel, compiled-binary CI smoke, docs site (Q10). Does **not** open contributions.
3. **Contribution gate** — required before outside agents may land nodes.
   Distinct from (2); after packages are published (strangers need something
   to build against). Constitution: [CONSTITUTION.md](./CONSTITUTION.md).
   Close the custody edges by construction, then open.
   - Plugin capability class on the manifest. `resolveDeployment` hands
     read-plugins a frozen `ToolContext` with no `resolveSigner`;
     signer-touching plugins are class (b), human-adjudicated.
   - Lint/test: declared read-only (`!requiresSigner` / `readOnlyHint`)
     must not be able to reach a signer.
   - Reviewer protocol: brief is injected; the diff is data, not
     instructions; author ≠ reviewer; findings published.
   - Provenance / trajectory review and x402-paid review compute are
     experiments (DESIGN §9), not openers.
4. **Phase 7–8** — `initlabsai/vibekit-agent` (hosted API + web agent),
   consuming published packages only.
