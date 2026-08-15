# VibeKit v2 — Design Doc

Status: **exploration / draft** · Owner: Gabriel Kuettel · Last updated: 2026-08-11

VibeKit v2 is a ground-up restart of this repo: a clean, stateless MCP server for Algorand built on published, reusable tool packages, with a plugin system so developers can extend it or deploy their own. The explorer spins out into its own repo as the flagship demo of the hosted API.

---

## 1. Decisions (locked)

| Decision | Choice |
|---|---|
| Repo strategy | **Two fresh monorepos**: `initlabs/vibekit` (MCP + CLI + packages) and `initlabs/vibekit-agent` (hosted API + explorer). Port tool handlers domain-by-domain; old repo stays runnable until cutover |
| Ownership / npm scope | **Init Labs LLC** · `@initlabs/*` (scope registration pending) |
| MCP spec | **2026-07-28 stateless spec** — no sessions, no init handshake, header-based routing |
| Chain SDK | **`algosdk@beta` (3.7.x)** directly — no algokit-utils. PQ (Falcon-1024) account support lands here first |
| Key custody | **`@algorandfoundation/keystore-node`** (OS keychain + AES-sealed metadata, RPC daemon over local socket) behind our own `Signer` interface |
| HashiCorp Vault | **Dropped** (~1,180 LOC deleted; `Signer` interface leaves the door open) |
| Explorer | Lives in **`initlabs/vibekit-agent`** with the API, redesigned with [Beautiful UI](https://www.beautifului.dev) primitives; consumes published packages + the API |
| CLI scope | init + agent/skill/MCP setup, **plus** localnet lifecycle and template bootstrapping — positioning vibekit CLI to deprecate AlgoKit CLI |
| Tests | Required — each ported domain lands with handler tests; no untested migration |

## 2. Goals

1. **Clean stateless MCP** conforming to the 2026-07-28 spec, horizontally scalable, deployable by anyone.
2. **Tools as published packages** (`@initlabs/*`) usable outside the MCP — in CLIs, servers, other people's projects.
3. **Plugin system**: a plugin is just an npm package exporting tools that conform to the published contract.
4. **Self-hostable**: `createVibekitMcp({ ... })` is a library; our deployment is a thin reference app anyone can copy.
5. **Simplified CLI** that also absorbs AlgoKit CLI's remaining jobs (localnet, templates).

### Non-goals

- Vault signing support.
- Dispenser packages as a standalone concept (localnet funding folds into the localnet module; testnet faucet TBD).
- Preserving the current explorer UI (full redesign in the new repo).
- Backwards compatibility with the v1 MCP tool surface where statelessness forces changes (e.g. `switch_account` / `switch_network` as server state).

## 3. Target repo layout

```
initlabs/vibekit                       # ~/Code/@initlabs/vibekit
├── apps/
│   ├── cli/                       # `vibekit` binary (Bun compile). init, agents/skills/MCP setup,
│   │                              #   localnet, templates
│   └── mcp/                       # thin reference deployment of @initlabs/mcp (stdio + streamable HTTP)
├── packages/
│   ├── core/                      # @initlabs/core — tool contract, ToolContext, NetworkClients,
│   │                              #   Signer interface, shared validators/formatters/utils
│   ├── mcp/                       # @initlabs/mcp — createVibekitMcp() server library (2026-07-28 spec)
│   ├── tools-network/             # @initlabs/tools-network      ┐
│   ├── tools-accounts/            # @initlabs/tools-accounts     │
│   ├── tools-assets/              # @initlabs/tools-assets       │  published domain tool packages
│   ├── tools-transactions/        # @initlabs/tools-transactions │  (each: ToolDefinition[] + handlers)
│   ├── tools-contracts/           # @initlabs/tools-contracts    ┘
│   ├── plugin-nfd/                # @initlabs/plugin-nfd          ┐ optional plugins — prove the
│   ├── plugin-alpha-arcade/       # @initlabs/plugin-alpha-arcade ┘ plugin system from day one
│   ├── signer-keystore/           # @initlabs/signer-keystore — keystore-node adapter
│   ├── signer-walletconnect/      # @initlabs/signer-walletconnect — port of provider-walletconnect
│   └── sdk/                       # @initlabs/sdk — client for the hosted API (replaces @getvibekit/sdk)

initlabs/vibekit-agent                 # ~/Code/@initlabs/vibekit-agent
├── apps/
│   ├── api/                       # hosted query API (LLM orchestration, Hono/Bun)
│   └── explorer/                  # Beautiful UI chat frontend, xArc feature (Next.js)
└── packages/                      # agent-side shared code as it emerges
```

The boundary between the two repos is the published-package surface: `vibekit-agent` consumes `@initlabs/*` from npm like any third party — no cross-repo workspace links. (`@initlabs/sdk` lives in `vibekit` because its types derive from the tool registry; if that coupling proves annoying in practice it migrates to `vibekit-agent` alongside the API whose contract it wraps.)

Conventions (one tier, no exceptions):

- Every package extends the root `tsconfig.base.json`. One module-resolution style, one import-extension style, decided once in the skeleton.
- Every published package builds to `dist/` with `exports` maps and `.d.ts`. No "source export" tier — consumers are external now.
- `algosdk` is a **peer dependency** of every tool/signer package; consumers control the version. Docs state plainly: packages stabilize when algosdk 3.7 does. (Caveat: peer ranges against a prerelease are awkward — see open question 9.)
- `zod` and `@initlabs/core` are **also peer dependencies** of every tool/signer/plugin package — exactly one copy of the contract and one Zod major (Zod 4, for native `z.toJSONSchema()`) may exist in a consumer's graph, or type identity breaks.
- **ESM-only** unless a concrete CJS consumer appears (open question 8).
- Versioning via **changesets**, fixed version group across `core` + `mcp` + `tools-*` (they evolve together); plugins and sdk version independently.
- Turbo `test` task from day one; CI builds and tests **every** workspace.

## 4. The tool contract (the product)

One shape, no variants. This is the single highest-leverage fix from v1, which had three
incompatible handler signatures forcing six copy-pasted adapter loops.

```ts
// @initlabs/core
interface ToolDefinition<P extends z.ZodType = z.ZodType, R extends z.ZodType = z.ZodType> {
  name: string
  description: string
  parameters: P
  /** Result schema. Input schemas alone can't generate SDK result types or MCP
   *  structured-content schemas — v1's regex-over-.d.ts hack was patching exactly
   *  this gap. Required for core tools; optional for plugins. */
  output?: R
  /** Write tools set this; hosts gate on it. Maps to MCP tool annotations
   *  (readOnlyHint / destructiveHint) in the adapter. */
  requiresSigner?: boolean
  /** Presentation hint, carried on the wire by the API. Every head (web explorer,
   *  TUI) renders results from data + this hint — never from hardcoded per-tool
   *  knowledge (v1's 127-line switch on tool names is the anti-pattern). */
  display?: 'table' | 'txn' | 'account' | 'asset' | 'markdown' | 'json'
  handler: (ctx: ToolContext, args: z.infer<P>) => Promise<ToolResult<z.infer<R>>>
}

/** Write tools return either an executed result or an unsigned group.
 *  `mode: 'compose'` is how browser/hosted flows (explorer, xArc) work: the server
 *  has no signer there — txns are built server-side, signed client-side. */
type ToolResult<T> = T | { unsignedGroup: string[] /* base64 txns */; summary: string }

interface ToolContext {
  network: NetworkConfig                // named net OR custom algod/indexer endpoints (localnet, private nets)
  algod: algosdk.Algodv2
  indexer: algosdk.Indexer
  /** 'execute' = sign & send via resolveSigner; 'compose' = return unsignedGroup. */
  mode: 'execute' | 'compose'
  /** Resolves a sender address to a signer. Absent in read-only and compose-only deployments. */
  resolveSigner?: (address: string) => Promise<algosdk.TransactionSigner>
  /** Plugin-provided clients, keyed by plugin name (nfd API client, alpha-arcade client, …). */
  services: Record<string, unknown>
}
```

- **`ToolContext` is constructed per request** — this is what makes the stateless spec trivial to satisfy. Network selection moves from server state to request config (HTTP: a namespaced header, e.g. `X-Algorand-Network`, with algod/indexer clients pooled per network; stdio: process config).
- **`Signer` is `algosdk.TransactionSigner`** (`(txnGroup, indexesToSign) => Promise<Uint8Array[]>`) — not a custom interface. Signers must see the whole group and sign a subset: WalletConnect and any co-signing/rekey flow require it, and it plugs directly into algosdk's composer. Inventing our own shape here was a v1-style mistake caught on review.
- **Results are JSON-safe by contract.** algosdk v3 emits `bigint` everywhere; core ships one codec (bigint→string, Uint8Array→base64) applied in the adapter, not per host. v1 scattered `sanitizeBigInts` across consumers.
- **Errors are thrown, not returned.** Handlers throw `ToolError` (typed code + user-safe message); each host adapter maps it once (MCP `isError`, API error JSON). No `{ error }` result shapes.
- **`services` bag** is how nfd- and alpha-arcade-style tools get their clients without bespoke handler signatures. A plugin declares a factory; the host runs it once and injects the result under the plugin's name (registry rejects duplicate plugin names and duplicate tool names at startup). Typing is by convention — a plugin exports a typed accessor (`getNfdService(ctx)`) so its own handlers stay type-safe.
- **Dynamic tools are first-class**: nothing in the contract assumes tools are statically compiled in. An ARC-56 spec can be turned into `ToolDefinition[]` at runtime — this is the seed of the explorer's xArc feature and lives in `tools-contracts` as `toolsFromArc56(spec)`. Note xArc runs through the **API**, not the MCP: the 2026 spec makes tool lists cacheable, so the MCP's list must stay deterministic per deployment.

```ts
// A plugin is just a package exporting this:
interface ToolPlugin {
  name: string                                    // becomes the services key
  tools: ToolDefinition[]
  createService?: (config: unknown) => unknown    // e.g. NfdApiClient
}
```

## 5. The MCP server (`@initlabs/mcp`)

A library, not an app:

```ts
import { createVibekitMcp } from '@initlabs/mcp'
import { networkTools } from '@initlabs/tools-network'
import { accountTools } from '@initlabs/tools-accounts'
import { nfdPlugin } from '@initlabs/plugin-nfd'

const server = createVibekitMcp({
  network: 'mainnet',                    // or per-request via header in HTTP mode
  tools: [...networkTools, ...accountTools],
  plugins: [nfdPlugin({ apiUrl: '...' })],
  signer: keystoreSigner(),              // optional — omit for read-only deployments
})
```

- Implements the **2026-07-28 stateless spec**: no session state, version/capabilities via `_meta`, `Mcp-Method`/`Mcp-Name` headers on Streamable HTTP.
- Two transports: **stdio** (local dev, spawned by `vibekit mcp` or agent config) and **Streamable HTTP** (self-hosted deployments).
- Exactly **one** generic `ToolDefinition → MCP tool` adapter (~40 LOC), replacing v1's three.
- `apps/mcp` is the reference deployment: a ~20-line file anyone can copy to deploy their own with their own plugin mix. That file **is** the "deploy your own MCP" documentation.
- **Security posture for HTTP**: the hosted/reference HTTP deployment is **read-only + compose-mode** — no server-side signer over HTTP, ever, in our deployments. Signing is a stdio/local capability (keystore daemon on the same machine) or an explicit self-host opt-in that requires the deployer to bring auth. This needs to be loud in the docs, because "deploy your own MCP" plus "signer" is a foot-gun.
- **Client compatibility is an open risk** (open question 7): agents in the wild still speak pre-2026 protocol versions. If the official TS SDK negotiates versions, we lean on that; if "stateless-only" excludes current Claude/Cursor/etc. clients, `vibekit init` would be configuring agents against a server they can't talk to. The spike must answer this empirically.

State that v1 kept in the server process and where it goes:

| v1 state | v2 home |
|---|---|
| Active account (`switch_account`) | Request parameter / deployment config; keystore daemon knows the keys |
| Active network (`switch_network`) | Deployment config (stdio) or request header (HTTP) |
| Provider sessions (WalletConnect) | `signer-walletconnect` package, state in the keystore/db layer it owns |
| App specs (`resolveAppSpec`) | Request-supplied (xArc path) or filesystem convention in stdio mode |

## 6. Signing & accounts

- **`@initlabs/signer-keystore`** wraps `@algorandfoundation/keystore-node`: keys in the OS keychain, metadata AES-sealed, and — critically — the **RPC daemon mode** (`keystore serve` over a Unix socket / named pipe) means the MCP process never holds key material. PQ-ready: keystore-node already chunks Falcon-1024 keys; algosdk 3.7 brings protocol-level PQ accounts (Q3 2026).
- **`@initlabs/signer-walletconnect`** is a port of v1's `provider-walletconnect` (the one v1 provider with real irreplaceable logic) onto `algosdk.TransactionSigner`. **Local/stdio-only**: pairing is interactive (QR + wait) and session-ful by nature — it cannot back a stateless HTTP deployment, and we don't pretend otherwise. Browser flows sign client-side via compose mode instead.
- **Keystore daemon lifecycle** is deliberately *not* ours: the `keystore` CLI owns `keystore serve`; `signer-keystore` is only ever an RPC client that fails with a clear "start the keystore daemon" error. This also sidesteps a real risk: the v1 CLI ships as a `bun build --compile` binary, and linking `@napi-rs/keyring`'s native addon into a compiled binary is exactly the kind of thing that breaks — talking to the daemon over a socket means the native code never enters our binary. (Spike verifies this.)
- **Account management CLI**: defer to keystore-node's own `keystore` CLI rather than rebuilding create/list/rename. `vibekit` may add thin aliases later if the UX warrants it.
- Deleted outright: `provider-interface`, `provider-keyring`, `provider-vault`, `keyring`, `dispenser-*`, most of `db`, mcp-server's `account-service.ts` (653 LOC) and `app-state.ts` (466 LOC).

Both foundation dependencies are pre-1.0 (`algosdk@3.7.0-beta.1`, `keystore-node@1.0.0-canary.1`). Policy: **pin exact versions, isolate behind our interfaces** (`Signer`, `NetworkClients`) so churn lands in one file per dependency, not across published packages.

## 7. CLI (`vibekit`)

Simplified relative to v1, but with a bigger mission: absorb the AlgoKit CLI jobs that matter for the vibekit workflow. Be precise about the boundary — AlgoKit CLI also does smart-contract compilation (puya), typed client generation, `doctor`, `goal` passthrough, and codespaces. **v2 absorbs init/templates/localnet only**; compilation and client generation stay with AlgoKit (or become future work). Saying "deprecates AlgoKit CLI" without this caveat overpromises.

| Command area | Notes |
|---|---|
| `vibekit init` | Bootstrap AI coding environment: agents, skills, MCP config (v1's core, ported and slimmed) |
| `vibekit mcp` | Start local MCP (stdio) — imports `@initlabs/mcp` as a *library*, killing v1's app→app dependency |
| `vibekit localnet …` | start/stop/reset/status — **re-implemented in TS** referencing AlgoKit CLI's open-source Docker orchestration: [`src/algokit/cli/localnet.py`](https://github.com/algorandfoundation/algokit-cli/blob/main/src/algokit/cli/localnet.py) (command layer) and [`src/algokit/core/sandbox.py`](https://github.com/algorandfoundation/algokit-cli/blob/main/src/algokit/core/sandbox.py) (compose-file generation + container lifecycle). Localnet funding (v1's dispenser-kmd) folds in here. **MVP subset only**: start/stop/reset/status + kmd funding; explicitly deferred: `goal` passthrough, codespaces, compose-config version migration (sandbox.py is 1,000+ lines — don't port it all) |
| `vibekit new` (or similar) | Template bootstrapping via **GitHub template repos** (Gabriel supplies templates) — no template engine in the CLI |
| `vibekit chat` *(post-MVP)* | TUI agent — a "talk to the chain" REPL powered by the vibekit-agent API via `@initlabs/sdk`, with **local keystore signing in execute mode** (the one head where the full reason→compose→sign→send loop runs with no browser/wallet ceremony). See §9 (Product surfaces) |

Explicitly gone: vault provisioning (~500 LOC), the provider/dispenser command trees, account CRUD (→ keystore CLI).

## 8. Hosted API, SDK, and the explorer split

Both live in **`initlabs/vibekit-agent`** — the hosted product monorepo, consuming `@initlabs/*` packages from npm.

- **`apps/api`** ports mostly as-is (it's already well-shaped: Hono, per-request tools, streaming) but its 376-line triple adapter collapses to one loop over the unified contract, and its tool registry becomes *the* registry that the SDK derives from — killing v1's four-place tool-name duplication.
- **`@initlabs/sdk`** replaces `@getvibekit/sdk`. The fragile regex-over-`.d.ts` type sync is replaced by generating types from the tool registry (the Zod schemas are the source of truth — derive both MCP inputSchemas and SDK types from them).
- **Explorer**: Next.js + Beautiful UI primitives (streaming text, thinking traces, tool chips, approval cards map 1:1 to what an agentic explorer renders). It consumes the hosted API via `@initlabs/sdk` and published tool packages for display metadata — no more `transpilePackages` reach-ins. Positioning: the flagship demo of "hook intelligent network interactions into your app" (e.g. an AlphaArcade-style betting app powering a chatbot), plus the **xArc** feature: upload an ARC-56 spec, get intelligent contract interaction via `toolsFromArc56`.

## 9. Product surfaces (heads)

The API + SDK are the product; every frontend is a thin head over them. The infra requirement that makes heads cheap: **the protocol carries everything** — streaming, tool results, presentation hints (`display` in §4), approval/compose flows all live in the API stream and `@initlabs/sdk`, never only in one head's components. Any affordance that exists solely in explorer React code is lost to every other head.

| Head | Status | Role | Signing |
|---|---|---|---|
| **Hosted explorer** (web) | Anchor — Phase 7 | Marketing surface, zero-friction demo, xArc playground, API-key funnel, shareable links | **Compose mode** — txns built server-side, signed client-side by the user's wallet |
| **TUI — `vibekit chat`** | Post-MVP (after Phase 6) | "Talk to the chain" REPL free with the CLI developers already installed. Localnet/testnet workflows | **Execute mode** — local keystore daemon; the only head with the full reason→sign→send loop, zero wallet ceremony |
| **Electron app** | Not building | Its one advantage (web UI + local keys) is replicable by a `vibekit agent` command that bridges the keystore daemon and serves the explorer UI at localhost — without auto-update infra, codesigning, or 150 MB binaries | — |
| **Desktop (Tauri)** | Back pocket | If real desktop demand appears (dock presence, chain-event notifications), Tauri wraps the same explorer frontend | Same as TUI |

Notes:

- The TUI is also the **SDK dogfood**: CLI lives in `initlabs/vibekit`, API in `vibekit-agent`, so `vibekit chat` consumes `@initlabs/sdk` from npm across the repo boundary — exactly the third-party posture the split enforces. If the SDK can't power a chat client cleanly, our own product finds out first.
- Scope guard: `vibekit chat` is a purpose-built network REPL powered by *our* API. It does **not** compete with Claude Code + the MCP (which make *your* agent Algorand-capable). Different jobs; keep it that way.
- Signing capability is per-head config, not per-product — the execute/compose mode split in §4 is what makes this table possible with no new machinery.

## 10. Open questions

1. ~~Where does `apps/api` live long-term?~~ **Resolved (2026-08-11): API + explorer form their own monorepo, `initlabs/vibekit-agent`.** The vibekit repo is the developer-tooling side (MCP, CLI, packages); vibekit-agent is the hosted product side.
2. **Package naming**: `@initlabs/core` vs `@initlabs/vibekit-core` — bare names are cleaner but generic in a company-wide scope that may later hold non-vibekit packages.
3. **Testnet faucet**: v1's dispenser-testnet (Foundation faucet client; AlgoKit's equivalent is [`core/dispenser.py`](https://github.com/algorandfoundation/algokit-cli/blob/main/src/algokit/core/dispenser.py)) — resurrect as a tool, a CLI command, or drop?
4. **`app_deploy` semantics**: algokit-utils' idempotent AppFactory deploy is the one non-trivial algokit dependency. Reimplement idempotent deploy on raw algosdk, or simplify to plain create?
5. ~~MCP SDK choice~~ **Resolved by spike (2026-08-11): official v2 SDK** (`@modelcontextprotocol/server` 2.x) — its per-request factory model matches our per-request `ToolContext` exactly.
6. **Ecosystem tools** (`search_ecosystem` + 454-line static dataset): port as a plugin with the data externalized, or drop from the MCP and keep it API-side only?
7. ~~Minimum client protocol version~~ **Resolved by spike (2026-08-11)**: the v2 SDK bridges 2025-era clients by default (verified empirically with a v1-SDK client against our stateless server, both transports' default postures). No extra compat work; today's agents are served.
8. **Module format**: ESM-only (draft assumption) or dual CJS/ESM? Dual doubles build/test surface for consumers we may not have.
9. **How to depend on `algosdk@beta`**: peer ranges against a prerelease (`>=3.7.0-beta.1`) behave badly in npm/semver. Option: ship algosdk as a *pinned regular dependency* until 3.7 stable, then flip to peer in one breaking release. Same question for `keystore-node@canary` inside `signer-keystore`.
10. **Docs site.** v1 has `apps/website` (Astro/Starlight, getvibekit.ai) — v2's layout doesn't account for it, but published packages for external developers *require* docs (contract reference, plugin authoring guide, self-hosting guide). Port the site into the new repo, or new docs under an Init Labs domain?
11. **License & copyright.** New org, published packages: pick the license early (Apache-2.0 matches the Algorand ecosystem; v1 is MIT © Gabriel Kuettel, so relicensing the ported code is the copyright holder's call — clean) and settle copyright headers/`author` fields before the first npm publish, not after.
12. **Keystore UX gap.** Deferring account CRUD to the `keystore` CLI assumes it's installed and its UX is acceptable for vibekit users. If canary UX is rough, `vibekit account …` thin aliases move from "maybe later" to launch scope. *Spike data point: CLI UX was solid (generate/list/export/sign/serve all clean) — leaning "defer to keystore CLI".*

## 11. Migration plan

Sequenced so each phase produces something runnable, and risk is front-loaded:

- **Phase 0 — Spike (de-risk the betas).** Minimal stateless MCP on the 2026-07-28 spec serving `network` + read-only `accounts` tools on raw `algosdk@beta`, plus one write tool (`send_payment`) signing through keystore-node's daemon. Throwaway code, keep the learnings. *Exit criterion: an agent completes a testnet payment end-to-end through the new stack.* Must also answer, explicitly: (a) does a **current** agent client (Claude Code today) successfully talk to the stateless server — i.e. open question 7; (b) does the keystore RPC socket work from a `bun build --compile` binary with no native addon linked in; (c) does the bigint→JSON codec round-trip cleanly on real algod/indexer responses; (d) does compose mode (unsigned group out, signature in) work end-to-end.
### Phase 0 results (2026-08-11) — ✅ all four verdicts passed

Spike code: `~/Code/@initlabs/vibekit/spike` (throwaway; keep for reference until Phase 2).

| Verdict | Result |
|---|---|
| (a) Client compat | ✅ **Both** a modern 2026-07-28 client and a legacy 2025-era client (v1 SDK, initialize handshake) talked to the same stateless HTTP server. The official v2 SDK bridges legacy clients by default (`legacy: 'stateless'` on HTTP, `'serve'` on stdio; bridged versions: 2025-11-25 … 2024-10-07). **Open questions 5 & 7 resolved**: use the official SDK; no extra compat work needed. |
| (b) Compiled binary | ✅ `bun build --compile` binary (95 MB) signed via the keystore daemon socket; the RPC-client import path pulls in no native addon. |
| (c) BigInt codec | ✅ One `jsonSafe` codec (bigint→number-if-safe-else-string, bytes→base64) round-tripped real algod responses (testnet + localnet reads, account info, tx confirmation). |
| (d) Compose mode | ✅ HTTP server (compose, no signer) returned a base64 `unsignedGroup`; the "wallet side" decoded, signed via keystore, submitted, confirmed. The hosted/browser write flow is viable. |

**Exit criterion**: payment end-to-end through the new stack — ✅ on **localnet** (keystore-daemon-signed via stateless MCP, confirmed round 108; before/after balances verified). The literal *testnet* run is blocked only on funds: the AlgoKit testnet dispenser token is expired (`vibekit dispenser login` to refresh); testnet reads verified against real nodes.

Implementation facts learned:

- **v2 SDK package names**: `@modelcontextprotocol/server` / `@modelcontextprotocol/client` (2.0.0) — the v1 monolith `@modelcontextprotocol/sdk` is frozen at protocol 2025-11-25. `createMcpHandler(factory)` builds a fresh server per HTTP request (exactly our per-request `ToolContext` model); `serveStdio(factory)` ditto per connection. `registerTool` takes full Zod schemas (Zod 4 works), annotations, and `_meta` — the `display` hint travels as `_meta['ai.vibekit/display']`.
- **Contract**: a `defineTool()` identity helper is required for `z.infer` to flow into handler args (annotating `const x: ToolDefinition` erases inference), plus an `AnyTool` erased type for registries. Bake both into `@initlabs/core`.
- **keystore-node canary held up**: generate/export/sign/list/serve all worked first try on Linux (Secret Service). Two adapter needs for `signer-keystore`: the daemon has no "list addresses" — the adapter must build an address book by `export()`ing each key's public key (cache it); and the RPC client holds the socket open — the adapter needs an explicit `close()` or CLI processes hang on exit. **Open question 12 leaning**: keystore CLI UX is solid; thin aliases can wait.
- **algosdk@beta**: `Transaction.bytesToSign()` + `attachSignature(addr, sig)` compose cleanly with `KeyStoreAPI.sign()`; `makePaymentTxnWithSuggestedParamsFromObject` / `waitForConfirmation` unchanged from v3 stable. No algokit-utils missed.
- **v1 bug found en route**: v1 MCP `switch_account` succeeds but `send_payment` then fails with "Account not found in keyring" (per-network keyring lookup mismatch) — more evidence for the rewrite; no fix planned in v1.

- **Phase 1 — Skeleton.** Fresh repo, tsconfig/turbo/changesets/CI, `core` with the tool contract + `Signer` + `NetworkClients`, `mcp` server library, `apps/mcp` reference deployment. ✅ **Done 2026-08-15** — initial commit in `~/Code/@initlabs/vibekit`: `@initlabs/core` (contract + codec + network clients, 11 tests) and `@initlabs/mcp` (one generic adapter, registry validation at startup, `./stdio` + `./http` entries, 7 in-memory round-trip tests); reference deployment smoke-tested live against testnet. Contract refinement from implementation: `ToolPlugin` carries a pre-built `service` value (author-side factory captures config) instead of a host-invoked `createService(config)` — the host never holds plugin config.
- **Phase 2 — Port read tools.** network → accounts → assets → transactions(read) → contracts(read), each domain landing with handler tests. Mostly mechanical: swap `AlgorandClient` context for raw clients (26 of ~38 call sites already reach through to raw algod/indexer).
- **Phase 3 — Write path.** Port `transactions/compose` onto algosdk's native composer; write tools for assets/contracts/transactions; `signer-keystore` + `signer-walletconnect`; resolve the `app_deploy` question.
- **Phase 4 — Plugins.** `plugin-nfd` and `plugin-alpha-arcade` (applying REFACTOR.md §1's format fixes in the port); these prove the plugin contract. Publish everything under `@initlabs`.
- **Phase 5 — CLI.** Port init/agents/skills, add localnet (from AlgoKit CLI reference) and template bootstrapping.
- **Phase 6 — API + SDK.** Stand up `initlabs/vibekit-agent`; port api onto the unified registry; new sdk with registry-derived types; deprecation notice on `@getvibekit/sdk`.
- **Phase 7 — Explorer.** Explorer in `vibekit-agent`, Beautiful UI redesign, xArc. Old vibekit repo archived after cutover.
- **Phase 8 — TUI (post-MVP).** `vibekit chat` in the CLI, built on `@initlabs/sdk` + local keystore execute mode. Gated on the SDK/protocol carrying presentation hints (§9) — which Phases 2–6 bake in, so this phase is purely a rendering exercise.

## 12. Reference: what dies from v1

| v1 | Fate |
|---|---|
| 3 tool-definition shapes, 6 adapter loops | 1 contract, 1 adapter per host |
| 4-place tool-name registry | 1 registry, everything derives |
| `provider-*`, `keyring`, `dispenser-*`, `config` (9 pkgs, ~1,900 LOC) | → `signer-keystore` + `signer-walletconnect` + localnet module |
| mcp-server `account-service.ts` + `app-state.ts` (1,119 LOC) | → per-request `ToolContext` + keystore daemon |
| algokit-utils | → raw `algosdk@beta` |
| CLI vault module (~500 LOC) | deleted |
| regex `.d.ts` type-sync in sdk | → types derived from Zod registry |
| 3 tsconfig conventions, 9 copy-pasted tsconfigs | 1 base config |
| 0 tests | tests required per ported domain |

## 13. References

**MCP (stateless spec)**
- [2026-07-28 spec release announcement](https://blog.modelcontextprotocol.io/posts/2026-07-28/)
- [2026-07-28 changelog — key changes](https://modelcontextprotocol.io/specification/2026-07-28/changelog)

**Signing & custody**
- [wallet-provider repo](https://github.com/algorandfoundation/wallet-provider) · [TUTORIAL.md](https://github.com/algorandfoundation/wallet-provider/blob/main/TUTORIAL.md) (provider/extension/store architecture)
- [wallet-provider-extensions repo](https://github.com/algorandfoundation/wallet-provider-extensions) — `keystore/node` directory is the source of `@algorandfoundation/keystore-node`
- [`@algorandfoundation/keystore-node` on npm](https://www.npmjs.com/package/@algorandfoundation/keystore-node) — pin `1.0.0-canary.1` (`next` tag) for the spike

**Chain SDK & post-quantum**
- [js-algorand-sdk repo](https://github.com/algorand/js-algorand-sdk) — beta channel is `algosdk@3.7.0-beta.1` (`npm i algosdk@beta`)
- [Algorand post-quantum roadmap](https://algorand.co/blog/algorand-post-quantum-cryptography-roadmap) — native Falcon-1024 accounts Q3 2026, Falcon-512 by year-end

**AlgoKit CLI (reference for re-implementation)**
- [algokit-cli repo](https://github.com/algorandfoundation/algokit-cli)
- Localnet: [`src/algokit/cli/localnet.py`](https://github.com/algorandfoundation/algokit-cli/blob/main/src/algokit/cli/localnet.py) (commands) · [`src/algokit/core/sandbox.py`](https://github.com/algorandfoundation/algokit-cli/blob/main/src/algokit/core/sandbox.py) (Docker Compose orchestration)
- Testnet dispenser: [`src/algokit/core/dispenser.py`](https://github.com/algorandfoundation/algokit-cli/blob/main/src/algokit/core/dispenser.py)

**Explorer**
- [Beautiful UI](https://www.beautifului.dev) — copy-paste AI-native primitives (streaming text, thinking traces, tool chips, approval cards, chat composer) by Turbo; design language for the new explorer repo
- [ARC-56 spec](https://github.com/algorandfoundation/ARCs/blob/main/ARCs/arc-0056.md) — the app-spec format behind `toolsFromArc56` and the xArc feature

**v1 carryover**
- `REFACTOR.md` in the v1 repo — §1 (raw numbers from alpha-arcade format functions) applies during the plugin-alpha-arcade port; §2 already re-landed in v1 (`67d49c0`); §3 is moot after the rewrite
