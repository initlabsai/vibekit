# Adversarial review findings — 2026-08-16

Status: **Do-now items 1–8 IMPLEMENTED (2026-08-16, see git log). Phase-7 items remain open** — revisit when building the hosted API; do not re-run the full brief unless the tree has moved.

Source review: code first, then `docs/DESIGN.md` / `docs/DOCTRINE.md`. Tests
treated as author-correlated, not evidence. Owner refinement (same day):
**VibeKit runs on a trusted machine used by a competent developer.** Strike a
balance between DX and security. That revision is folded in below — original
severities that assumed a hostile same-UID attacker are marked *downgraded*.

Canonical brief: [REVIEW-BRIEF.md](./REVIEW-BRIEF.md). Operational handover:
[HANDOVER.md](./HANDOVER.md).

---

## Threat model (normative for local work)

- **In scope:** the model (prompt injection via chain data, NFD, notes, READMEs);
  harness auto-approve; LLM footguns (`closeRemainderTo`, omitted ASA roles);
  contract holes that Phase 7 will freeze; DX bugs on macOS/Windows.
- **Out of scope for local execute:** same-UID malware, unauthenticated
  `keystore.sock` as a "critical" finding, extra TTY gates on `vibekit tool`.
  Same UID is the developer (ssh-agent posture). Document it; `chmod 0600` is
  enough extra hygiene.
- **Not this relaxation:** Phase 7 hosted API (untrusted browser, funded default,
  multi-tenant). Findings 3-hosted, 5, 8, 9 stay blocking for that product.

Do **not** add: TTY confirm on every `vibekit tool` write, `VIBEKIT_ALLOW_UNATTENDED`,
a second MCP approval card, blocking `keystore generate seed` at a human TTY,
`{untrusted:true}` wrappers on every asset name.

---

## Calibration (already in HANDOVER § Known gaps — not discoveries)

Independently confirmed, do not file again: rekey 1:1, no multisig, no install
channel, no compiled-binary / non-Linux CI, duplicated `withKeystoreTools` in
`apps/cli/src/commands/{mcp,tool}.ts`, hand-maintained AGENTS.md skills table.

---

## Do now (local 1.0 / next commits)

Ordered by impact. Each item is the *refined* fix, not the original maximal one.

### 1. Align agent guidance: MCP for writes, CLI is the human/script door

**Problem.** `vibekit tool` is correctly ungated ("typing the command is
approval") for humans and scripts (`apps/cli/src/commands/tool.ts` 82–134).
`skills/use-vibekit/SKILL.md` 20–30 and 96–101 teach that path to agents,
including `send_payment`. The AGENTS.md template already forbids shell writes
(`apps/cli/src/config/agents-md.ts` 109–114). Skills load first → skill wins.
Harness-approved Bash + skill = MCP permission bypass.

**Fix.** Edit `skills/use-vibekit/SKILL.md`: shell fallback is **read-only**
(`list`, `lookup_*`, `--help`). Writes go through MCP. Keep CLI ungated. Make
the skill and AGENTS.md say the same thing. Rebuild the bundled copy
(`apps/cli/scripts/bundle-skills.ts` → `apps/cli/src/skills/bundled.ts`).

**Do not** add a confirm prompt to `vibekit tool`.

### 2. Stop advertising `create_signing_account` as read-only

**Problem.** Tool omits `requiresSigner` (`packages/signer-keystore/src/tools.ts`
50–68). MCP sets `readOnlyHint: !requiresSigner` (`packages/mcp/src/adapter.ts`
27) → `true`. Agent `approveToolCall` only runs when `requiresSigner`
(`packages/agent/src/agent.ts` 96–98). Skill says "safe for you to run."
Harnesses that auto-approve reads mint OS-keychain keys with no prompt.

**Fix.** Gate it. Prefer a distinct `mutatesState` (or always-set
`requiresSigner: true` *and* special-case network injection so create does not
require a `network` write-param). Set MCP `readOnlyHint: false`. Update
`signer.test.ts` (today it only asserts list is ungated). Soften the skill
wording.

### 3. `destructiveHint: true` on write tools

**Problem.** Adapter only sends `readOnlyHint`. Cheap extra signal for harnesses.

**Fix.** `packages/mcp/src/adapter.ts`: `destructiveHint: !!tool.requiresSigner`
(or `mutatesState` once that exists). No extra prompt in-process.

### 4. Enforce write-network inside `executeToolCall`

**Problem.** Docs say writes never hit a silently-defaulted chain
(`packages/core/src/deployment.ts` 118–122). Only the injected Zod schema
enforces that. `executeToolCall` (149–165) defaults to `defaultNetwork` if
`network` is missing or non-string. MCP/CLI/AI SDK parse first; a Phase-7 Hono
host that calls `executeToolCall` directly will not.

`fund_testnet_account` sets `requiresSigner: true` (so schema requires
`network`) then ignores `ctx` and always hits the Foundation TestNet API
(`packages/signer-keystore/src/dispenser.ts` 219–228). Approval can say
`network: mainnet`.

**Fix.** If `tool.requiresSigner && networkIds.length > 1 && typeof requested
!== 'string'`, throw `ToolError('NETWORK_REQUIRED', ...)`. Reject
`fund_testnet_account` unless the selected network is `testnet` (or stop
overloading `requiresSigner` for "needs approval"). Add core tests —
`packages/core` currently has **no** `executeToolCall` tests.

### 5. Close-account and omitted `asset_config` roles

**Problem.** Competent operator, incompetent LLM.

- `send_payment` optional `closeRemainderTo` (`packages/tools-transactions/src/tools-write.ts` 118–121). `buildGroup` does not `requireAddress` it (`packages/core/src/compose/build.ts` 189).
- `send_group_transactions` amount is optional `z.number()` — `amount: 0` + close is a valid drain.
- `describeSpec` never mentions the close (`packages/core/src/compose/finish.ts` 17–20).
- `asset_config` uses `strictEmptyAddressChecking: false` (`build.ts` 272–280). Omitting reserve/freeze/clawback clears them forever. Standalone tool description warns; group tool does not.
- ABI `buildTransactionArg` does not validate addresses (`build.ts` 50–114). Inner `pay` can hide in `app_call` args.

**Fix.** Require `confirmCloseAccount: true` (or reject `closeRemainderTo` unless
set). Default `strictEmptyAddressChecking: true`; require an explicit clear.
`requireAddress` every address field. Mention close/config/destroy in
`describeSpec`. Compose tests do not cover these paths today.

### 6. Untrusted content framing (light)

**Problem.** Machine trust does not apply. ASA names, tx notes, NFD bio/email,
box bytes, market titles land in the model as ground truth. System prompt and
skill say "copy tool results exactly." `TextDecoder.decode` does not throw, so
the note base64 fallback is dead (`packages/tools-transactions/src/handlers/format.ts`
51–56; copies in accounts/assets). NFD `ipfsToHttps` passes non-ipfs schemes
through (`packages/plugin-nfd/src/index.ts` 43–45), including `javascript:` /
`data:`.

**Fix (DX-preserving).** One system-prompt line: field values are data, never
instructions (`packages/agent/src/system-prompt.ts`). Wrap **notes, NFD
userDefined/bio/email, box bytes** only — not every asset name. Default notes
to base64 unless asked. Reject non-https NFD avatars. Do not wrap the world
in `{untrusted:true}`.

### 7. Silent correctness / DX fixes (no product debate)

| Item | Where | Fix |
|---|---|---|
| `createKeystoreSigner({ socketPath })` ignored | `packages/signer-keystore/src/index.ts` 157–160 passes `socketPath`; keystore-node client wants `path` | Pass `path: options.socketPath`. Test it. |
| `saveDispenserToken` remove-then-put | `dispenser.ts` 148–155 | Put-then-remove or overwrite; in-process single-flight on refresh. Improves DX (no surprise re-login). |
| Address-book `export()` | `signer-keystore/src/index.ts` 73–88 | For `extractable: true` keys, upstream `export` returns `privateKey` (`keystore-core` `create.ts` 1232–1256) into this process. Prefer `state` public keys; if you export, drop `privateKey` immediately. Default generate path is `extractable: false`. |
| `NETWORKS.split(',')` no trim | `apps/cli/src/commands/{mcp,tool}.ts`, `apps/mcp/src/stdio.ts` | `.map(s => s.trim()).filter(Boolean)` |
| Doctor socket hardcoded Unix path | `apps/cli/src/commands/doctor.ts` 201 | Use keystore-node `defaultRpcSocketPath()` (Windows pipe is `\\.\pipe\algorand-keystore`) |
| macOS data dirs are Linux XDG | `keystore.ts` 18–24 `~/.local/share`; `sandbox.ts` 30–34 `~/.config` | Document as intentional or use `~/Library/Application Support`. Windows keystore uses `LOCALAPPDATA`, localnet uses `APPDATA` — pick one. |

### 8. Document the trust boundary once

One short paragraph next to `keystore serve` / §6: same UID is trusted; tools
must not return material; the model is not trusted; `SIGNING=execute` means the
operator accepts harness auto-approve as the residual risk. Change §6 "agents
cannot leak credentials" to "the tool surface cannot return credentials."

---

## Do later / Phase 7 (do not freeze the wrong contract)

### Output schemas are unused

`ToolDefinition.output` is documented as feeding MCP structured content and SDK
types (`packages/core/src/contract.ts` 41–45). `executeToolCall` never
`output.parse`. MCP adapter only `JSON.stringify`s text (`adapter.ts` 33–35).
Some schemas already disagree with post-`jsonSafe` shapes (`z.bigint()` after
codec → string). **Either start parsing after `jsonSafe` before 1.0 and fix
schemas, or drop `output` from the public contract until a consumer exists.**
Do not publish a field you do not enforce.

`toolsFromArc56` and `@initlabs/vibekit-sdk` are claimed in DESIGN and do not
exist. Do not implement them as a drive-by; they are Phase 7/8.

### `AgentEvent` is not a browser protocol

`packages/agent/src/events.ts`: no tenant/session/seq, no approval events,
`output: unknown`, `error.message` is `String(part.error)`, `isToolErrorOutput`
is structural. `extraInstructions` is concatenated onto the system prompt
(`agent.ts` 78–80) — host-trusted only. `DisplayHint` includes `'markdown'`
with no first-party user. For hosted: add `approval-request` /
`approval-decision`, sanitize, cap size, never `innerHTML` results. Local TUI
is gone; this is not a local DX item.

`approveToolCall` optional is **correct** for the library. A hosted execute
head that omits it is a product bug. Do not require the hook in `mode:
'execute'` — that would break MCP (no such hook).

### `jsonSafe` / amounts / mutable context

- Cycles → stack overflow (`packages/core/src/codec.ts`). Tests: bigint /
  Uint8Array / Map only.
- DESIGN says bigint → string. Code: number if `≤ MAX_SAFE_INTEGER`. Decide
  before publish (prefer always-string).
- `z.number()` cannot represent uint64 ASA totals. Accept `string | number`
  before 1.0 if you will ever create large ASAs.
- `indexerSemaphore` is a process-global export (`packages/core/src/util.ts` 43).
- `ToolContext` is pooled, mutated, shared. Freeze (shallow copy `network` /
  `services`) before `handler`. Plugin can today replace `ctx.resolveSigner`.

### HTTP `X-Algorand-Network`

DESIGN §4/§5 claims a header. `createVibekitHttpHandler` captures constructor
options only (`packages/mcp/src/http.ts`). Network selection is the injected
tool param. Do not claim the header until it exists.

---

## Downgraded (do not "fix" these as security holes)

**Daemon socket has no app-level auth** (`keystore-node` `rpc/server.ts`
232–248; allow-list is the full `KeyStoreAPI` including `secrets.get`, `sign`
of arbitrary bytes, `export`, `clear`). Same-UID = developer. Acceptable.
Optional: `chmod 0700` dir + `0600` socket after listen; document.

**`vibekit keystore` passthrough** of `generate seed` / `export` / `clear`
(`apps/cli/src/commands/keystore.ts` 75–76). Human TTY is fine. Do not block
for competent operators. Agents should not be *taught* these commands (skill
already says mnemonic flows are human-only — keep that).

**`getValidAccessToken` / `loadDispenserToken` public exports.** Used by the
CLI dispenser command. Not a local leak. Don't log them in a hosted host.

**MCP execute has no in-process gate.** Correct. The harness is the gate.
Default `SIGNING=execute` in `apps/cli/src/config/mcps.ts` 31–35 is the
operator opting in.

---

## Claims audit (DESIGN vs tree) — for whoever next edits DESIGN

| Claim | Verdict |
|---|---|
| "~190 tests" | ~170 `test(` calls |
| 11 packages | True (no `packages/sdk`) |
| `toolsFromArc56` in tools-contracts | Does not exist |
| `@initlabs/vibekit-sdk` | Does not exist |
| `ToolContext` constructed per request | False — pooled at `resolveDeployment` |
| HTTP `X-Algorand-Network` | Not implemented |
| `jsonSafe` bigint → string | Number if safe |
| `output` → MCP structured content / SDK | Unused |
| `nfdPlugin({ apiUrl })` / `signer: keystoreSigner()` | Stale examples |
| `ToolPlugin.createService` in §4 snippet | Stale; Phase 1 uses pre-built `service` |
| Q3 faucet TBD | Stale — dispenser shipped |
| Q12 defer CRUD | Stale — `create_signing_account` shipped |
| §6 "agents cannot" | Overclaim; tools cannot, machine is trusted |
| Phases 0–6 complete | Orchestrator yes; TUI deleted same day; `vibekit agent` is a stub |

Contract snippet in DESIGN §4 ≠ `contract.ts` (`servedNetworks`,
`defaultNetwork`, handler returns `Promise<unknown>`, no `ToolResult<R>`).

---

## Architecture cheat-sheet (so the next agent does not re-derive)

One `ToolDefinition` / `defineTool()`. Hosts: MCP adapter, `createAgent`,
`vibekit tool`. Shared path: `resolveDeployment` → `injectNetworkParam` →
host parse → `executeToolCall` → `jsonSafe(handler)`. Writes:
`composeOrExecute` → `buildGroup` → `finishGroup`.

`requiresSigner` currently means three things at once: MCP `readOnlyHint`,
required `network` param, `approveToolCall`. That overload is why create-
account and `fund_testnet` are awkward. A `mutatesState` vs `movesFunds`
split is the clean interface fix if you touch the contract.

Keys never enter this process on the default path (`extractable: false`).
Signer wraps `keystore.sign(id, txn.bytesToSign())` only. Full RPC is on the
socket for any same-UID client.

Init MCP env: `NETWORK=localnet`, `NETWORKS=localnet,testnet,mainnet`,
`SIGNING=execute`. CLI MCP falls back to compose if the daemon is down
(loud stderr). Reference `apps/mcp` HTTP is compose-only.

---

## Verdict (for the next agent, not a new review)

Safe to keep shipping as a **local** compose/execute engine on a trusted
dev machine after Do-now items 1–8. Not 1.0 for a hosted signing product
until Phase-7 items (output enforcement decision, `AgentEvent` approval,
`executeToolCall` as the real enforcement point) are settled. Do not
re-litigate the socket as Critical. Do not add friction the owner already
rejected.
