# Handover — VibeKit v2 Dev Stack

Status: **Phases 0–6 complete · holding for adversarial review before the 1.0 publish gate**
Owner: Gabriel Kuettel · Init Labs LLC · Last updated: 2026-08-16

This document is the operational handover: what exists, how to verify it, what
environment it assumes, and what happens next. The *design* rationale lives in
[DESIGN.md](./DESIGN.md) (canonical; §6 and §10 are normative); the operating
theory behind all of it is [DOCTRINE.md](./DOCTRINE.md) — read it to see the forest. The adversarial
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
bunx turbo run build typecheck test      # ~190 tests, all workspaces
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

## State + custody model (one paragraph)

No databases. Keys and credentials live behind the keystore daemon (vibekit-managed
install); agents wield capabilities and see metadata, never material (§6). Network and
sender are explicit per request; the conversation is the only session memory (§10).
Localnet is regenerable Docker config. Skills are repo content bundled at build.

## Known gaps (deliberate, tracked)

- **Rekeyed accounts**: signer resolves address→key 1:1; a rekeyed account would sign
  with the wrong key (chain rejects — safe but broken). Pre-1.0 correctness item.
- **Multisig**: unsupported. Post-1.0.
- **Distribution**: no install channel for the binary; blocked on the 1.0 gate.
- **CI**: unit suites run, but nothing exercises the compiled binary (where the
  `$bunfs` bug class lives) or non-Linux platforms.
- Small debts: AGENTS.md skills table is hand-maintained (should generate from the
  bundle); `withKeystoreTools`/deployment construction duplicated across
  `apps/cli/src/commands/{mcp,tool}.ts`.
- Vendored language skills removed pending vibekit-consistent refactor (git history
  keeps them; `skills/README.md` explains).

## Heritage

v1 lives at `github.com/gabrielkuettel/vibekit` (`~/Code/vibekit`) — legacy, kept
runnable until cutover, **no longer the home of any current documentation**. Its
lessons are encoded in DESIGN.md §13 ("what dies from v1"). The 0.x release remains
what users have installed; `vibekit doctor --fix` migrates their machines.

## Next

1. **Adversarial review** — [REVIEW-BRIEF.md](./REVIEW-BRIEF.md). Run it in a fresh
   context with no access to this narrative.
2. **1.0 publish gate** — license (Q11), algosdk pin decision
   (Q9), npm publish, install channel, docs site (Q10).
3. **Phase 7–8** — `initlabsai/vibekit-agent` (hosted API + web agent), consuming
   published packages only.
