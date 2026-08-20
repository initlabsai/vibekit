# VibeKit v2 — Design Doc

Status: **executing.** Phases 0–6 are complete. The first provisional
`packages/experience` slice, its fixture-backed OpenTUI and web renderers, the
write/approval flow, live compose/simulate wiring, and keystore signing with
on-chain confirmation in the TUI (the full draft → simulate → inspect →
approve → sign → confirm write path, live-verified on localnet) are
implemented. Next: the hosted API/SDK, alongside the 1.0 publish gate.
Hosted API and SDK work remains in Phase 7. Owner: Gabriel Kuettel. Last
updated: 2026-08-19.

> **Current snapshot (2026-08-19).** Phases 0–6 are complete. Live field
> sessions hardened the stack. The implementation includes core, five tool
> domains, two plugins, the keystore signer, the agent loop, MCP adapters,
> the CLI, skills, and the reference deployment. The codebase implements
> the immediate findings of the 2026-08-16 adversarial review. The next
> workstreams are the 1.0 package/binary release, the separate
> contribution-safety gate, and the hosted API/SDK. The first
> fixture-backed browser-safe experience spine now lives in
> `packages/experience`; `apps/tui` and `apps/web` now render the same
> fixture-backed vertical slice. Internal app
> development does not wait for npm publication; the public
> package boundary
> is proven separately with packed external-consumer verification.
> `DESIGN.md` and `CONSTITUTION.md` are the complete documentation set
> under `docs/`. Git history retains retired handover and review
> artifacts. The v1 repo (`gabrielkuettel/vibekit`) is heritage only.

> **Product direction (2026-08-19, revised twice same day — owner's call).**
> The Explorer is a **chat-first transcript with a results feed**: the left
> column holds requests and brief one-sentence summaries; the right pane is
> a chronological, sticky-bottom **feed of card groups — one group per
> request (its truncated prompt is the divider), one block per tool
> result**, so an agent turn that composes several tool calls ("my
> portfolio") stacks several cards in one group, and follow-up questions
> accrete below their predecessors instead of replacing them. (Paged
> sheets were tried first and retired same-day: one-document-per-request
> is an artifact model, and conversation is accretive.) Focus follows the
> lazygit convention: the composer is always focused by default and plain
> letters always type; `tab` hands focus to the feed where single keys
> work (`tab`/`c`/`esc` back, `←/→` jump between groups, `↑/↓` scroll,
> `s` sort, `x` close group); a bottom keybar always lists the keys valid
> in the current mode; the focused pane carries the accent border. Below
> ~96 columns the split collapses and `tab` toggles chat ↔ full-screen
> feed. The payment
> decision is a **true modal** — centered, double-bordered, rendering the
> decoded draft bytes, owning all input until enter/esc. Navigation
> (accounts, later assets/apps/blocks) exists as typed commands —
> secondary, not the organizing surface. The earlier workspace/tabs/canvas
> chrome was tried in full and retired as too complex; its command
> protocol and reducer were deleted (2026-08-20) once measurement showed
> one head dispatching one command. A head renders one titled trusted
> view (`ExplorerArtifact`); if the hosted API later needs a multi-artifact
> model, it gets rebuilt from that consumer's real requirements. A top bar
> carries a network
> chip (localnet/testnet/mainnet — core ships the public endpoints;
> `ctrl+n` or `network <name>` switches, hosts are per-network, records
> stay tagged with the network that produced them). While a thinking model
> reasons, the stream shows at the feed's tail and disappears when the
> turn's first card renders. Cards dispatch on the
> tool's declared view cue (the single `view` field on ToolDefinition —
> a trusted semantic id or a coarse hint), so third-party tools that
> declare a trusted view and match the wire schema get the same cards —
> or ship their own views. Wallet/signer connection UI comes later; keystore signing after
> modal approval works today. `vibekit explore` launches the TUI as a
> separate process.

VibeKit v2 is a restart of this repo from a new base. It is a clean,
stateless MCP server for Algorand. It is built from reusable package
workspaces prepared for npm publication. A plugin system lets developers
extend it or deploy their own.

Two target stacks, one brain (§9). The local dev stack is CLI + MCP + TUI
Explorer. The hosted product stack is API + SDK + web VibeKit Agent. Both
run the same tools through the same orchestrator and presentation protocol.

---

## 1. Decisions (locked)

| Decision               | Choice                                                                                                                                                                                                                                                                                                                                                                      |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Repo strategy          | **One monorepo, several products**: `initlabsai/vibekit` contains the public engine/packages and private API, TUI, and web apps. Apps are independent build/deployment units and consume only public package exports. Packed external-consumer tests preserve the npm boundary. A separate small reference implementation may follow 1.0; the old v1 repo is heritage only. |
| Ownership / npm scope  | **Init Labs LLC** · `@initlabs/*` (org registered on npm, owner verified 2026-08-16)                                                                                                                                                                                                                                                                                        |
| MCP spec               | **2026-07-28 stateless spec**. No sessions. No init handshake. Header-based routing.                                                                                                                                                                                                                                                                                        |
| Chain SDK              | **`algosdk@3.7.0`** directly. No algokit-utils. The repository pins 3.7.0 while public packages declare a `>=3.7.0 <4` peer range.                                                                                                                                                                                                                                          |
| Key custody            | **`@algorandfoundation/keystore-node`** (OS keychain + AES-sealed metadata, RPC daemon over local socket) through an adapter that satisfies `algosdk.TransactionSigner`                                                                                                                                                                                                     |
| HashiCorp Vault        | **Dropped** (about 1,180 LOC deleted. The signer adapter boundary leaves room for another custody provider.)                                                                                                                                                                                                                                                                |
| Agentic Explorer       | A chat-first transcript with a chronological results feed. Each request owns a group of trusted result cards; persistent chrome owns network state and approval, while the composer routes identifiers and natural language into the feed.                                                                                                                                  |
| Explorer renderers     | **React on both heads**: `@opentui/react` for the full-screen TUI and Next.js/React for web. Share domain/view models, workspace state, hooks, and selected semantic component trees behind platform primitives. Do not target pixel-identical output.                                                                                                                      |
| Generative UI boundary | The model can select and compose versioned, Zod-validated view specifications from a trusted registry. It never emits JSX, HTML, terminal markup, or executable UI code.                                                                                                                                                                                                    |
| Models                 | **BYOM everywhere**. The harness brings its own (init path). TUI + API take API keys / local models via `@initlabs/vibekit-agent` provider config. Funded default on the API (Together today, x402 experiment later). Provider OAuth is opportunistic, never a pillar.                                                                                                      |
| TUI                    | **Restored 2026-08-19 as a new product shape.** The private `apps/tui` OpenTUI app implements the fixture-backed chat/feed slice, deterministic lookup, agent lane, and keystore-approved payment flow. `vibekit explore` launches it as a separate process.                                                                                                                     |
| CLI scope              | init + agent/skill/MCP setup, **plus** localnet lifecycle and template bootstrapping. This replaces the AlgoKit CLI for those jobs; compilation and typed-client generation remain separate.                                                                                                                                                                                |
| Tests                  | Required. Each ported domain lands with handler tests. No untested migration.                                                                                                                                                                                                                                                                                               |

## 2. Goals

1. **Clean stateless MCP** that conforms to the 2026-07-28 spec. It is
   horizontally scalable. Anyone can deploy it.
2. **Tools as reusable packages** (`@initlabs/*`) usable outside the MCP,
   in CLIs, servers, and other people's projects, then published at the 1.0
   gate.
3. **Plugin system**: a plugin is an npm package that exports tools that
   conform to the published contract.
4. **Self-hostable**: `createVibekitMcp({ ... })` is a library. Our
   deployment is a thin reference app anyone can copy.
5. **Simplified CLI** that also absorbs the remaining AlgoKit CLI jobs
   (localnet, templates).
6. **One agentic Explorer experience across terminal and web**, with
   deterministic direct lookup, trusted structured views, and explicit
   human approval for writes.
7. **Canonical project skills** installed by the CLI so coding agents can
   implement smart contracts, generated clients, frontend interfaces, and
   broader Algorand workflows using current, internally consistent patterns.

### Non-goals

- Vault signing support.
- Dispenser packages as a standalone concept. Localnet funding lives in the
  localnet module. Authenticated TestNet funding lives in
  `signer-keystore` as a conditional tool plus a human CLI grant.
- Port of Lora or the v1 Explorer component implementation wholesale.
  Their workflows, domain coverage, enrichment, and visual language are
  reference inputs. The new experience has a new typed presentation
  architecture.
- Backwards compatibility with the v1 MCP tool surface where
  statelessness forces changes. Examples are `switch_account` /
  `switch_network` as server state.

### Current gates and known gaps

The clean-checkout verification path is `bun install`, then
`bunx turbo run build typecheck test`. The compiled CLI also needs a
smoke test. Filesystem behavior differs inside the Bun binary.

Development has confirmation on Linux with Bun, Node/npm, Docker Compose
v2, and a Secret Service keychain. macOS, Windows, their
keychains/sockets, and compiled-binary CI remain without confirmation.

**Consolidation workstreams (2026-08-20, owner-approved, in execution
order).** (1) A packed out-of-workspace consumer check (`verify:packed`)
runs from now on, not just at the 1.0 gate. (2) View-id honesty: one view
id = one wire shape — `application.locals` splits from a unified
`application.state` (with a `scope: 'global' | 'local'` discriminator),
`asset.holdings` splits from `asset.list`, and `get_network` demotes to
the coarse `table` hint. (3) One schema family: monetary wire fields
are integer `*MicroAlgos` (done — tools emit microALGOs directly; the
float-to-micro conversion shims in experience are gone), tools has
a dependency-clean `./views` subpath (done — schema-only `schemas.ts`
modules per domain, zod-only import graph pinned by test), and
`packages/experience` parses wires with `viewDataSchemas` instead of
maintaining shadow wire schemas (done — the shadow wire schemas are
deleted; host-added envelope keys like `address` parse beside the tools
schema).
(4) Experience reorganizes into vertical slices (done — `src/views/` has
one module per entity family colocating data schemas, builders, and view
models; `src/flows/` holds the payment machine; `src/core/` the spine).
(5) The TUI app reorganizes into vertical slices (done — app.tsx is a
~390-line composition root over seven feature hooks in `src/slices/`,
with per-family cards in `src/cards/`).
(6) `packages/agent` adds a first-class `zerosignal` provider (ZeroSignal
is OpenAI-compatible at `localhost:8080/v1`, wallet-admission, USDC on
Algorand) with `/v1/models` discovery and a helpful daemon-down error
(done — provider sugar plus probeZeroSignal/listZeroSignalModels
helpers; the TUI preflights the daemon and lists the live catalog when
no model is configured). Follow-up (done): `vibekit explore setup` — a
CLI wizard scoped under the Explorer's namespace (the toolkit lanes
never ask about models) that probes daemons, picks from live catalogs,
and persists provider/model to `~/.config/vibekit/config.json`; the
agent package serves it through a model-SDK-free `./config` subpath.
Phase 7 note (owner direction, to investigate): the hosted web Explorer
may use ZeroSignal's browser-native path (passkey wallet, no daemon) so
visitors bring their own metered inference — depends on whether an
embeddable browser client exists beyond their chat app.

**Explorer parity workstreams (2026-08-20, owner-approved; Lora is the
reference bar — meet or exceed, TUI first, every feature lands
renderer-independent in `packages/experience` before its first
renderer).** (L1) Transaction group flow graph: a pure graph model
mirroring Lora's proven shape — entity columns (account / application /
asset / op-up, with app-escrow merging, rekey/clawback associated
accounts, and account-number badges), depth-first transaction rows with
inner-transaction nesting and close-out "remainder" sub-rows, and three
edge representations (vector / self-loop / point) with typed labels —
validated against wires recorded from Lora's real-transaction snapshot
corpus; then a TUI swimlane card for `transaction.group`. (L2) My Apps:
scan the launch directory for app specs (ARC-56, ARC-32, ARC-4 —
normalized to ARC-56), a screen with deployed vs local-spec sections,
NFD names accepted as direct-lane input. (L3) `toolsFromArc56(spec)` —
the xArc seed, contracts domain — runtime ToolDefinition[] with typed
arg forms, signerless simulate in compose mode, tools joining the
agent's set; ABI decoding (method names on graph edges, args/returns on
cards) wherever a My Apps spec is known. (L4) Write-flow
generalization: interception by shape (any requiresSigner tool emitting
UnsignedGroupResult) instead of by tool name, group-shaped flow
records, and the L1 graph rendered inside the approval modal —
sign-what-you-see. (L5) TUX shakedown: scripted tmux journeys over the
real TUI, findings triaged and fixed. (L6) Live data: an algod
wait-for-block tail feed (latest blocks/transactions, live entity
activity), post-shakedown. Skipped deliberately: the transaction wizard
(the agent plus compose tools is our answer), browser wallet-connect
(keystore is the TUI signing story), media/PNG rendering (web-head
material). Backlog: TEAL viewer, box browsing polish, asset
metadata/traits, ASCII QR, custom-network CRUD, ARC-89, NFD reverse
display beside addresses.

Before the 1.0 publish gate: add the root license file and settle copyright
metadata; package manifests currently declare Apache-2.0. Decide whether the
keystore canary is acceptable for release. Add an install channel and
cross-platform binary smoke coverage. Pack the public packages, install them in
an out-of-workspace consumer fixture with workspace resolution unavailable,
and build and test that fixture. Resolve rekeyed account signing. The signer
uses algosdk's `addressWithSignersFromRawEd25519Signer` (since 3.7.0), while
both the old and current algosdk serialization paths set `sgnr` when the
transaction sender differs from the signing key. What remains is resolution:
map a rekeyed sender to the local key that is its auth address. Decide app-call
box-reference support. Multisig is post-1.0; algosdk's signer APIs can compose
with the daemon's raw ed25519 signer for multisig and lsig, so no custom
cryptography is needed when they land.

Resolved deployments already freeze each `ToolContext` and its services
registry. Before you accept outside plugins, add capability-scoped contexts:
remove signer access from read-only plugins and test that the boundary is
real. Apply the uncorrelated review rules in `CONSTITUTION.md`.

The first fixture-backed vertical slice is implemented in both renderers and
proves the provisional browser-safe result, approval, presentation, and write
flow contracts. Keep `ViewSpec` and `WorkspaceCommand` provisional until the
hosted API/SDK work and an external consumer prove the package boundary.

## 3. Target repo layout

```
initlabsai/vibekit                       # ~/Code/@initlabs/vibekit
├── apps/
│   ├── cli/                       # `vibekit` binary (Bun compile). init, agents/skills/MCP setup,
│   │                              #   localnet, templates
│   ├── mcp/                       # thin reference deployment of @initlabs/vibekit-mcp (stdio + streamable HTTP)
│   ├── api/                       # planned private hosted API (Hono/Bun)
│   ├── tui/                       # private full-screen @opentui/react Explorer
│   └── web/                       # private thin Next.js Explorer renderer
├── packages/
│   ├── core/                      # @initlabs/vibekit-core — tool contract, ToolContext, NetworkClients,
│   │                              #   compose engine, shared validators/formatters/utils
│   ├── mcp/                       # @initlabs/vibekit-mcp — createVibekitMcp() server library (2026-07-28 spec)
│   ├── tools/                     # @initlabs/vibekit-tools — the domain tools (accounts, assets,
│   │                              #   contracts, network, transactions) as per-domain exports; merged
│   │                              #   from five packages 2026-08-20 — every consumer imported all five
│   ├── plugin-nfd/                # @initlabs/vibekit-plugin-nfd          ┐ optional plugins — prove the
│   ├── plugin-alpha-arcade/       # @initlabs/vibekit-plugin-alpha-arcade ┘ plugin system from day one
│   ├── signer-keystore/           # @initlabs/vibekit-signer-keystore — keystore-node adapter (the only signer pkg)
│   ├── agent/                     # @initlabs/vibekit-agent — the orchestrator: LLM + tool loop + streaming over
│   │                              #   ToolDefinition[]; BYOM provider config. Used by the TUI and the API
│   ├── experience/                # provisional browser-safe routing, protocol, reducer, fixtures, and view models
│   ├── views-react/               # planned selected semantic React view composition
│   └── sdk/                       # planned @initlabs/vibekit-sdk hosted API client
├── skills/                        # canonical agent skills bundled into the CLI (see §7)
├── test-prompts/                  # agent-run acceptance tests
└── docs/                          # DESIGN.md and CONSTITUTION.md
```

All official product surfaces live in this monorepo. This is a source and
coordination boundary, not a deployment boundary: `apps/api`, `apps/tui`, and
`apps/web` are private terminal nodes that build, ship, and deploy
independently. No package may depend on an app.

Workspace apps depend on `@initlabs/*` through `workspace:*`, but may import
only exported package entry points. Relative imports across workspaces, deep
imports into package source, and app-to-app source imports are forbidden. This
allows engine, protocol, and first-party consumers to change atomically without
hiding an npm-only dependency. Before release, packed tarballs are installed
and built in a fixture outside the workspace to prove the real consumer edge.

`packages/experience` is browser-safe and owns the shared protocol and
semantic state. `packages/views-react` contains only composition that both
React renderers actually share. OpenTUI and HTML primitives begin inside their
respective apps; create renderer-specific packages only when another real
consumer earns the abstraction.

`@initlabs/vibekit-sdk` lives next to the API whose wire contract it wraps and
depends only on published schemas, never API implementation internals. A small
separate reference implementation may be useful after 1.0 as an external
integration example. It is not the home of a first-party product.

Conventions (one tier, no exceptions):

- Every package extends the root `tsconfig.base.json`. One
  module-resolution style. One import-extension style. Decided once in
  the skeleton.
- Every published package builds to `dist/` with `exports` maps and
  `.d.ts`. No "source export" tier. Workspace consumers must remain capable of
  consuming the packed package externally.
- `algosdk` is a **peer dependency** of every tool/signer package.
  Consumers control the compatible version through the `>=3.7.0 <4` range;
  repository development and runtime installs pin 3.7.0 exactly.
- `zod` and `@initlabs/vibekit-core` are **also peer dependencies** of
  every tool/signer/plugin package. Exactly one copy of the contract and
  one Zod major (Zod 4, for native `z.toJSONSchema()`) can exist in a
  consumer's graph. If not, type identity breaks.
- **ESM-only** unless a concrete CJS consumer appears (open question 8).
- Versioning via **changesets**. Fixed version group across `core` +
  `mcp` + `tools` (they evolve together). Plugins and sdk version
  independently.
- Apps are private and packages are publishable by default. The provisional
  `packages/experience` package is currently private until its protocol is
  frozen; apps are leaves in the dependency graph and remain separate
  release/deployment artifacts.
- Turbo `test` task from day one. CI builds and tests **every** workspace, plus
  the packed external-consumer fixture at the release gate.

## 4. The tool contract (the product)

One shape. No variants. This is the single highest-leverage fix from v1.
v1 had three incompatible handler signatures. Those signatures forced six
copy-pasted adapter loops.

```ts
// @initlabs/vibekit-core — current implemented contract
type DisplayHint = "table" | "txn" | "account" | "asset" | "markdown" | "json";

interface ToolDefinition<P extends z.ZodType = z.ZodType> {
  name: string;
  description: string;
  parameters: P;
  /** Enforced after jsonSafe; describes the actual wire shape. */
  output?: z.ZodType;
  /** Moves funds. Forces explicit network and host approval. */
  requiresSigner?: boolean;
  /** Changes state without spending user funds. Host approval still applies. */
  mutatesState?: boolean;
  /** The one view cue: a semantic Explorer id or a coarse hint. */
  view?: string;
  handler: (ctx: ToolContext, args: z.infer<P>) => Promise<unknown>;
}

interface UnsignedGroupResult {
  unsignedGroup: string[]; // base64 transactions, in group order
  summary: string;
}

interface ToolContext {
  network: NetworkConfig;
  servedNetworks: string[];
  defaultNetwork: string;
  algod: algosdk.Algodv2;
  indexer: algosdk.Indexer;
  mode: "execute" | "compose";
  resolveSigner?: (address: string) => Promise<algosdk.TransactionSigner>;
  services: Record<string, unknown>;
}
```

Write tools are one-shot named verbs (`send_payment`, `asset_*`, `app_*`)
plus `send_group_transactions` / `simulate_transactions` for atomic mixes.
Payment specs use `amountMicroAlgos`; ASA transfers use `amount` in base
units. Reads (`get_asset_info`, `app_get_info`, `app_list_methods`) live
on the domain read arrays, not on the write exports.

- **`ToolContext` is pooled per network at startup** (`resolveDeployment`)
  and selected per request. Nothing request-scoped is stored on it. That
  is what makes the stateless spec trivial to satisfy. Resolved contexts
  and their services registries are frozen before handler invocation.
  Network selection moves from server state to request config. Today that
  means an injected `network` tool parameter with clients pooled per network.
- **`Signer` is `algosdk.TransactionSigner`**
  (`(txnGroup, indexesToSign) => Promise<Uint8Array[]>`). It is not a
  custom interface. Signers must see the whole group and sign a subset.
  WalletConnect and any co-signing/rekey flow require it. It plugs
  directly into the composer of algosdk. Inventing our own shape here
  was a v1-style mistake caught on review.
- **Results are JSON-safe by contract.** algosdk v3 emits `bigint`
  everywhere. Core ships one codec. bigint becomes number when safe, and
  string otherwise. Uint8Array becomes base64. The adapter applies the
  codec, not each host. Always-string is under consideration
  pre-publish. v1 scattered `sanitizeBigInts` across consumers.
- **Errors are thrown, not returned.** Handlers throw `ToolError` (typed
  code + user-safe message). Each host adapter maps it once (MCP
  `isError`, API error JSON). No `{ error }` result shapes.
- **`services` bag** is how nfd- and alpha-arcade-style tools get their
  clients without bespoke handler signatures. A plugin factory constructs
  its service and returns it on `ToolPlugin`; the host injects that value
  under the plugin name. The registry rejects duplicate plugin names and
  duplicate tool names at startup. Typing is by convention. A plugin exports
  a typed accessor (`getNfdService(ctx)`) so its own handlers stay type-safe.
- **Dynamic tools are first-class.** Nothing in the contract assumes
  tools are statically compiled in. An ARC-56 spec can be turned into
  `ToolDefinition[]` at runtime. This is the seed of the explorer xArc
  feature. It will live in the tools package's contracts domain as `toolsFromArc56(spec)`
  (Phase 7/8 work, not yet implemented). Note: xArc runs through the
  **API**, not the MCP. The 2026 spec makes tool lists cacheable, so the
  MCP list must stay deterministic per deployment.

### 4.1 Presentation contract (provisional implementation, not frozen)

A tool declares one `view` cue. Dotted ids (`transaction.detail`) are
semantic Explorer views; the experience registry decides which are
trusted. Plain words (`table`, `txn`, `json`, `markdown`, `account`) are
coarse rendering hints for tools without a trusted view (writes, plugins,
generic JSON). Tools own capabilities and structured data. They do not
own layouts. `@initlabs/vibekit-tools` exports `viewDataSchemas` and
`ViewData<'…'>` — the wire shape per view id, pinned by test to the tool
declarations — so a downstream consumer can build custom components
against typed tool output without the experience package.
`@initlabs/vibekit-tools/views` is the dependency-clean import for
browsers: the same `viewDataSchemas` object through a subpath whose
transitive module graph is zod-only.

The first `0.1.0-provisional` implementation now lives in
`@initlabs/vibekit-experience`. It validates structured result records and
references by result or tool-call id with optional data paths; trusts
`transaction.detail`/`list`/`group`, `account.portfolio`/`summary`/`list`,
`asset.detail`/`list`/`holdings`/`holders`,
`application.detail`/`list`/`state`/`locals`/`logs`/`box`,
`block.detail`/`list`, and `network.status`; supports open,
replace, patch, focus, and pin commands; represents approval request and
decision states; and derives renderer-ready view models plus related-entity
actions from an immutable client-owned result store. `block.detail` is a header (type totals only). Listing or filtering that
round is a separate `search_transactions` call (`minRound`/`maxRound`,
optional `txType`) that renders `transaction.list`.
The fixture-backed TUI and web passes now exercise the same provisional
contract. The write flow is now observable protocol state: versioned
`write.stage` events (draft, simulate, inspect, confirm) carry only result
references, a pure write-flow reducer enforces
draft → simulate → inspect → approval request → decision → confirm ordering
(approval must reference exactly the inspected result and correlate by
tool-call and request id), and a payment flow view model derives authoritative
sender, network, amount, fees, and balance effects from structured results,
refusing to present a simulation that disagrees with the draft. Both renderers
drive the same machine from the same fixture events. Amounts travel as
microALGO integers (never floats) with exact digit-math formatting, and the
draft record carries the actual base64 unsigned group as its ground truth.
The flow now also runs on live data: a shared signerless compose-only host
(`@initlabs/vibekit-experience/live`) composes real payments and simulations
on localnet through `executeToolCall`, decodes the authoritative facts from
the group bytes themselves, and a shared controller advances the same machine
in both renderers — the TUI in-process and the browser through a thin
provisional server route that Phase 7's API replaces. An orchestrator
`tool-result` event mapper wraps `AgentEvent` payloads as structured result
records. The full write path is now protocol state: a `signed` stage sits
between `approved` and `confirmed` and is reachable only from a recorded
approved decision. The TUI's renderer-specific custody adapter signs through
the keystore daemon, the shared host verifies every signature wraps exactly
the approved draft bytes before recording it, submission broadcasts through
the same host, and the confirmation is a real on-chain record whose txId must
match a signed txId. The browser remains custody-less: its live flow ends at
the approval decision by explicit refusal until wallet adapters land.
Interaction pacing is renderer-owned and human-shaped: a shared controller
auto-advances the mechanical stages (each still an observable protocol event,
streamed as it lands) and pauses only at the approval card — the one human
decision — then completes signing and submission after it. Sample mode runs
the same controller through a fixture host that replays the recorded real
flow. The trusted view registry now holds the first-party Explorer catalog:
transaction detail/list/group, account portfolio/summary/list, asset
detail/list/holders, application detail/list/state/logs/box, block
detail/list, and network status. Plugin views (NFD, ecosystem) remain
unwired. Tools declare that cue as `view` on `ToolDefinition` — the
single source; there is no tool-name or hint fallback.
The Accounts surface is signer-scoped (the keystore address book as the
landing, live indexer portfolios as the detail). A typed `pay` uses the
active keystore account as sender. Bare numeric ids query asset,
application, and block candidates concurrently and present every typed
match. The TUI's natural-language lane runs `@initlabs/vibekit-agent`
in-process (BYOM: `vibekit explore setup` persists provider/model to
`~/.config/vibekit/config.json`, `VIBEKIT_AGENT_*` env vars override —
anthropic, openai, ollama, zerosignal, or any OpenAI-compatible
endpoint; API keys stay in env, never on disk) over a compose-only,
signerless
deployment. The model never emits UI or workspace commands in this slice:
known tool results map deterministically onto trusted views renderer-side,
unknown tools keep raw records, and an agent-composed `send_payment` group
is intercepted into the same approval card as a typed `pay` — approval,
keystore signing, and submission stay outside the model's reach. Narration
belongs to the request's feed group. A model-driven view-selection event
is deferred to the API/protocol-freeze work.

The exact `ViewSpec` / `WorkspaceCommand` schema is frozen only after the
first fixture-backed TUI/web vertical slice. These constraints are
already locked:

- Every message is versioned and Zod-validated at the API/SDK boundary.
- Views reference structured tool results (normally by tool-call id and
  optional data path). The model does not copy authoritative IDs or
  amounts into prose.
- `view` is a trusted registry id such as `transaction.detail`,
  `account.portfolio`, `transactions.table`, or `entity.compare`.
- The model can open, replace, patch, focus, or pin views. It must not
  emit JSX, HTML, terminal markup, component imports, or executable UI
  code.
- Unknown views and third-party tools fall back to schema-derived table,
  key/value, markdown, or JSON renderers.
- Approval requests and decisions are protocol events, not a blocking
  callback hidden inside one renderer. The UI shows the actual unsigned
  group, simulation, sender, network, fees, and effects before signing.
- Web and TUI render the same semantic view contract. Platform
  primitives, charts/media, wallet/keystore adapters, focus, and
  responsive layout remain renderer-specific.

```ts
// A plugin is just a package exporting this:
interface ToolPlugin {
  name: string;
  tools: ToolDefinition[];
  service?: unknown; // host injects at ctx.services[name]
}
```

## 5. The MCP server (`@initlabs/vibekit-mcp`)

A library, not an app:

```ts
import { createVibekitMcp } from "@initlabs/vibekit-mcp";
import { accountTools, networkTools } from "@initlabs/vibekit-tools";
import { nfdPlugin } from "@initlabs/vibekit-plugin-nfd";

const server = createVibekitMcp({
  network: "mainnet",
  mode: "execute", // use 'compose' and omit the signer for unsigned groups
  tools: [...networkTools, ...accountTools],
  plugins: [nfdPlugin()],
  resolveSigner: (addr) => signer.resolveSigner(addr),
});
```

- Implements the **2026-07-28 stateless spec**: no session state,
  version/capabilities via `_meta`, `Mcp-Method`/`Mcp-Name` headers on
  Streamable HTTP.
- Two transports: **stdio** (local dev, spawned by `vibekit mcp` or agent
  config) and **Streamable HTTP** (self-hosted deployments).
- Exactly **one** generic `ToolDefinition → MCP tool` adapter (about 40
  LOC), replacing v1's three.
- `apps/mcp` is the reference deployment: a small set of files anyone can
  copy to deploy their own tool and plugin mix. Those files are executable
  self-hosting documentation.
- **Security posture for HTTP**: the hosted/reference HTTP deployment is
  **signerless and compose-only**. It exposes read and write tools, but writes
  return unsigned groups. No server-side signer over HTTP, ever, in our
  deployments. Signing is a stdio/local capability (keystore daemon on the
  same machine) or an explicit self-host opt-in that requires the deployer to
  bring auth. This needs to be loud in the docs. "Deploy your own MCP" plus
  "signer" is a foot-gun.
- **Client compatibility is resolved** (open question 7). The official v2 SDK
  bridges legacy clients, and both modern and 2025-era clients were tested
  against the stateless server over its supported transports.

State that v1 kept in the server process, and where it goes:

| v1 state                          | v2 home                                                                                             |
| --------------------------------- | --------------------------------------------------------------------------------------------------- |
| Active account (`switch_account`) | Request parameter / deployment config. The keystore daemon knows the keys.                          |
| Active network (`switch_network`) | Deployment default plus the injected per-call `network` tool parameter in multi-network deployments |
| Provider sessions (WalletConnect) | **Dropped from v2** (2026-08-15). Wallet connections move client-side into the explorer, later.     |
| App specs (`resolveAppSpec`)      | Request-supplied (xArc path) or filesystem convention in stdio mode                                 |

## 6. Signing & accounts

- **`@initlabs/vibekit-signer-keystore`** wraps
  `@algorandfoundation/keystore-node`. Keys sit in the OS keychain.
  Metadata is AES-sealed. The **RPC daemon mode** (`keystore serve` over
  a Unix socket / named pipe) means the MCP process never holds key
  material. PQ-ready: keystore-node already chunks Falcon-1024 keys.
  algosdk 3.7 provides protocol-level PQ account support.
- ~~signer-walletconnect~~ **Dropped (2026-08-15).** Too much complexity
  for an underused feature. Devs who build contracts keep keys in the OS
  keystore. Wallet connections belong to the _explorer_, client-side in
  `apps/web`, signing compose-mode groups.
  This also deletes the last genuinely stateful component that v2 planned
  to own (pairing persistence) and 1,625 LOC of v1 port work.
  `signer-keystore` is the only signer package.
- **Keystore daemon lifecycle** — refined 2026-08-16. The daemon _code,
  storage format, and native addon_ remain upstream's. They run under
  node, outside our binary, across the socket. Unchanged. Its **presence
  and version are vibekit-managed**. `vibekit keystore <args>`
  auto-provisions the pinned keystore-node into the vibekit data dir
  (`~/.local/share/vibekit/keystore-cli/<version>`, via npm --prefix)
  and passes through. No global installs on developer machines. No
  version drift. At the time, the npm `latest` tag pointed at a stale beta and made
  unmanaged installs a live hazard. `doctor --fix` self-heals. Same
  relationship `vibekit localnet` has with the algod image. Original
  rationale preserved: the `keystore` CLI owns `keystore serve`.
  `signer-keystore` is only ever an RPC client that fails with a clear
  "start the keystore daemon" error. This also sidesteps a real risk:
  the v1 CLI ships as a `bun build --compile` binary, and linking
  `@napi-rs/keyring`'s native addon into a compiled binary is exactly
  the kind of thing that breaks. Talk to the daemon over a socket. Then
  the native code never enters our binary. (The spike confirms this.)
- **Account management CLI**: defer to the `keystore` CLI of
  keystore-node rather than rebuild create/list/rename. `vibekit` can
  add thin aliases later if the UX warrants it. **Agent-side discovery
  (added 2026-08-16):** `signer-keystore` exports
  `createSigningAddressesTool` — a read tool (`list_signing_addresses`)
  that exposes the daemon address book. Hosts register it only in
  execute-mode deployments. Live query of the daemon each call. No
  stored state (§10 holds). This answers the "list my accounts" question
  every first session asks. **Create added 2026-08-16** (from a Grok
  field report): `create_signing_account` generates ed25519 inside the
  daemon over RPC (unextractable, address-only response). This also
  sidesteps the daemon stale-view limitation. Keys created by the raw
  CLI while `keystore serve` runs are invisible until restart. This is
  documented in the skills. An upstream fix is desirable. Mnemonic/seed
  flows remain human-only. Q12 stance amended: create is now
  agent-facing. Rename/remove/import stay with the keystore CLI.
- Deleted outright: `provider-interface`, `provider-keyring`,
  `provider-vault`, `keyring`, `dispenser-*`, most of `db`,
  mcp-server's `account-service.ts` (653 LOC) and `app-state.ts` (466
  LOC).

**Secrets policy (normative, 2026-08-16).** The keystore daemon secrets
store (`secrets.put/get/list/remove` over the same RPC socket) is v2's
**only** home for credentials. Values are sealed at rest by the same
driver as key material. This covers dispenser tokens, plugin API keys
(keyed by convention: `vibekit.dispenser.<network>`,
`vibekit.plugin.<name>.<key>`), and any future paid-service auth. The
bright line mirrors the key model exactly:

- **Agents see metadata, never plaintext.** Non-secret metadata (id,
  name, expiry) mirrors into the reactive store and can be exposed via
  tools. A raw `secrets.get` must never be an agent-facing tool. A
  decrypted value in a tool result is in the transcript, the harness
  logs, and the model provider's hands. Precisely: **the tool surface
  cannot return credentials.** The guarantee is about what crosses the
  tool-result boundary. It is not a claim that a same-UID process cannot
  read the daemon (see trust boundary below).
- **Agents wield capabilities that consume secrets in-handler.** Tools
  like `fund_testnet_account` read the secret inside the tool process
  and return only outcomes (txIds, statuses). This is the `sign` pattern
  applied to credentials. Refresh/rotation exchanges likewise happen
  in-handler. Agents orchestrate lifecycle. They detect expiry from
  metadata, invoke refresh, and tell the human when a human grant is
  required. They are never able to read a value.
- **Secrets enter via human channels only** (CLI prompts, OAuth device
  flows like `vibekit dispenser login`). They never enter through the
  model context window. Then nothing to seal has already leaked.
- Plugin services resolve their credentials from the daemon at
  service-construction time. No env-var/dotfile sprawl. One vault. One
  `keystore serve`. One custody story for keys and credentials alike.

**Trust boundary (normative, from the adversarial review).** VibeKit's
local dev stack runs on a **trusted machine operated by a competent
developer**. Any same-UID process can reach the daemon socket (full API).
That is the ssh-agent posture. It is accepted and documented. It is not a
vulnerability. What is _not_ trusted is **the model**. Prompt injection
via on-chain data (asset names, notes, NFD fields) is in scope. That is
why writes are gated (harness approval + `requiresSigner`/`mutatesState`
hints + explicit network enforcement in `executeToolCall`). Close/clear
actions demand explicit confirmation flags. The system prompt frames
on-chain strings as data. `SIGNING=execute` means the operator accepts
harness auto-approve as the residual risk. **Phase 7 (hosted,
multi-tenant, untrusted browsers) gets none of these relaxations.**

The repository pins `algosdk@3.7.0` for development and app runtimes while
published packages expose a `>=3.7.0 <4` peer range. The keystore remains pinned
to `keystore-node@1.0.0-canary.3`. Isolate custody behind the
`algosdk.TransactionSigner` adapter and network construction behind
`NetworkClients`, so dependency churn lands at narrow seams.

## 7. CLI (`vibekit`)

Simplified relative to v1, but with a bigger mission: absorb the AlgoKit
CLI jobs that matter for the vibekit workflow. Be precise about the
boundary. AlgoKit CLI also does smart-contract compilation (puya), typed
client generation, `doctor`, `goal` passthrough, and codespaces. **v2
absorbs init/templates/localnet only.** Compilation and client generation
stay with AlgoKit (or become future work). A claim that this "deprecates
AlgoKit CLI" without this caveat overpromises.

| Command area                    | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `vibekit init`                  | Bootstrap AI coding environment: agents, skills, MCP config (v1's core, ported and slimmed)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `vibekit mcp`                   | Start local MCP (stdio). Imports `@initlabs/vibekit-mcp` as a _library_. This kills v1's app→app dependency.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `vibekit localnet …`            | start/stop/reset/status. **Re-implemented in TS** with AlgoKit CLI open-source Docker orchestration as reference: [`src/algokit/cli/localnet.py`](https://github.com/algorandfoundation/algokit-cli/blob/main/src/algokit/cli/localnet.py) (command layer) and [`src/algokit/core/sandbox.py`](https://github.com/algorandfoundation/algokit-cli/blob/main/src/algokit/core/sandbox.py) (compose-file generation + container lifecycle). Localnet funding (v1's dispenser-kmd) folds in here. **MVP subset only**: start/stop/reset/status + kmd funding. Explicitly deferred: `goal` passthrough, codespaces, compose-config version migration (sandbox.py is 1,000+ lines. Do not port it all.)                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `vibekit new` (or similar)      | Template bootstrapping via **GitHub template repos**. No template engine in the CLI. **Live (2026-08-15)**: `initlabsai/algorand-starter-{contracts,fullstack,kitchensink}` — three additive tiers, public template repos synced from a private dev monorepo (`initlabsai/algorand-starter-templates`, single source of truth against tier drift). `vibekit new` fetches the tarball (confirmed: 23 files for contracts). No git. No npm needed. Templates no longer invoke AlgoKit CLI in the build path (puya-ts + algokit-client-generator are lockfile-pinned devDependencies). `algokit localnet start` is the **single remaining AlgoKit CLI touchpoint**, so `vibekit localnet` completes the AlgoKit-free path. An `npm create` wrapper stays optional future work over the same tarballs. **Composed with init (2026-08-16):** after extraction, `new` runs init's agent-setup flow (`runInitAt`) into the fresh directory. Skills and MCP configs come from the CLI (single source of truth). They are never baked into template repos. That path means 3 repos times every skills/MCP-format change. `init` stays standalone for existing projects. |
| `vibekit tool <name> [json]`    | **The full tool surface as a CLI** (added 2026-08-16): one generic `ToolDefinition → CLI` adapter over the same `resolveDeployment`/`executeToolCall` core. `tool list`, per-tool `--help` (JSON Schema from zod), args as one JSON string, results as JSON. Gives agents a _correct_ shell fallback when no MCP client is wired (observed failure mode: agents fell back to shell and hallucinated algokit commands) and humans a scriptable interface. Third thin host over the engine. Zero per-tool code.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **Skills (canonical, in-repo)** | **Decided 2026-08-16**: `skills/` at the repo root is the canonical agent-skill set, bundled into the CLI at build time (no network fetch). It is the product channel for teaching coding agents correct contract, generated-client, frontend, and general Algorand patterns. The current safe bundle contains two vibekit-authored skills: `use-vibekit` covers tool access paths, meta-tool harnesses, the shell fallback, the account/keystore model, networks, signing, and denominations; `vibekit-project-setup` covers new/init/localnet/doctor. **Curated down to those two on the same day** (owner's call): the nine vendored upstream language/stack skills (algorand-devrel/algorand-agent-skills, MIT) proved too algokit-coupled. Live pi sessions showed weak models pattern-matching skill content over the generated AGENTS.md precedence table and flailing into algokit commands. They live in git history and return individually as each is refactored to be vibekit-consistent. The generated project AGENTS.md carries an algokit→vibekit command-precedence table for residual references.                                             |
| `vibekit doctor`                | Diagnoses and repairs (`--fix`) field problems: v1 binaries shadowing v2 on PATH, broken/legacy MCP entries (`/$bunfs` compiled-binary paths, v1 `vibekit-mcp` key, v1 env vars), missing Docker/keystore. Added 2026-08-16 after live v1-conflict debugging. Init also merges into existing configs (foreign MCP servers survive, v1 key migrated).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `vibekit explore`               | **Pending CLI integration:** launch the private `apps/tui` OpenTUI Explorer. The app runs independently today; its distribution boundary remains open question 13.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `vibekit agent`                 | Launch the hosted web VibeKit Agent in a browser. Until Phase 8 ships, it prints the current path (`vibekit init` with the user's own harness).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |

Explicitly gone from v1: vault provisioning (about 500 LOC), provider trees,
standalone dispenser packages, and general account CRUD. Their narrow
replacements are `vibekit dispenser` for the TestNet authorization grant,
agent-facing create/list tools, and the managed keystore CLI for human-only
key operations.

## 8. Hosted API, SDK, and shared Explorer

The API, SDK, and Explorer are first-party workspaces in this monorepo. Apps
consume `@initlabs/*` through public exports using `workspace:*`; the release
fixture consumes the same packages from packed tarballs. Co-location makes
protocol changes atomic without turning the apps into one runtime or one
deployment:

- **`apps/api`** is a thin Hono wrapper over `@initlabs/vibekit-agent`,
  with BYOM config and per-request tool selection. Hosted writes are
  always compose-only. The service never holds wallet keys.
- **`@initlabs/vibekit-sdk`** replaces `@getvibekit/sdk`. Zod tool and
  protocol schemas generate its types. There is no
  regex-over-declarations sync step.
- **`apps/tui`** is a full-screen `@opentui/react` Explorer using local or
  BYOM models and the local keystore daemon. It is a chat-first transcript and
  results feed, with cards and an explicit approval modal; it is not the old
  Ink experiment.
- **`apps/web`** is the Next.js VibeKit Agent. It uses the hosted API,
  browser wallet adapters, web-native charts/media, and selected
  Beautiful UI parts.
- **Shared experience packages** own input classification, state
  transitions, view models, and semantic React
  composition. TUI primitives (`<box>`, `<text>`, focus/key handling) and
  web primitives (HTML, CSS, responsive layout, wallet UX) stay in their apps.
  Extract renderer-specific packages only after a second consumer appears.

## 9. Products and Explorer interaction model (revised 2026-08-19)

The shared brain is **`@initlabs/vibekit-agent`**: model providers, tool
loop, streaming, and approval interception over the same
`ToolDefinition[]` as every other host. The Explorer adds a typed
presentation protocol on top.

| Head                  | Experience                                           | Model                  | Signing                                       |
| --------------------- | ---------------------------------------------------- | ---------------------- | --------------------------------------------- |
| **Agent harness**     | MCP + skills installed by `vibekit init`             | Harness model          | Local keystore, execute mode                  |
| **TUI Explorer**      | Chat-first terminal transcript with results feed     | BYOM/local             | Local keystore after explicit in-app review   |
| **Hosted API + SDK**  | Stateless orchestration and structured event stream  | BYOM or funded default | Compose only. Never holds keys.               |
| **Web VibeKit Agent** | Same Explorer semantics in a richer browser renderer | Via API                | Connected wallet after explicit in-app review |

The default screen has stable chrome: a two-row top bar (wordmark and
network, then the active wallet chip and assets/apps/txns buttons), a
session index beside the results feed on wide terminals, and a compact
composer docked at the bottom. `ctrl+w` opens the wallet picker;
`ctrl+1`/`ctrl+2`/`ctrl+3` open that account's assets, opted-in apps, and
transactions using the existing list cards. `[`/`]` cycle the active
account on those pages. The composer stays on the chat screen. Each request appends a feed group containing
its narration and cards. Below roughly 96 columns the split collapses to one
pane. Both heads organize the experience without tabs or a canvas: the TUI
as an accretive feed, the web head as one open `ExplorerArtifact` at a time.

TUI cards use the Init Labs warm-black and antique brass palette
(`#c4a06a`). They take the v1 Explorer's information hierarchy — kicker,
type chip, status pill, hero amount, from→to, labeled facts, stat strip —
and render it with OpenTUI primitives (`rounded` frames, raised chips).
List and detail cards for accounts, assets, applications, blocks, and
transactions use Lora labeled-fact rows: id, from/to, type, human time,
decimal amount with unit, fee, round, note, and holdings. `lookup_transaction`
attaches ASA name/decimals so an asset transfer shows `520 HAFN`, not base
units. Pasting a 44-character group ID, or `group <id>`, looks the atomic
group up through `lookup_transaction_group` and renders the group card.
Transaction IDs, asset IDs, accounts, application IDs, group IDs, and block
rounds are brass and underlined: a click copies the full value even when
the card truncates it. They do not use v1 teal or HTML layout. Web can
share the same hierarchy later without sharing terminal markup.

Input follows two lanes:

1. A deterministic classifier recognizes transaction IDs, addresses, app
   IDs, asset IDs, and known commands before any model call. Ambiguous
   numeric IDs can query block, asset, and app candidates concurrently
   and present typed matches. `accounts` opens the sender picker;
   `list my accounts` looks the keystore address book up on chain and
   renders an `account.list` card — it does not wait for the model.
2. Natural language enters the agent loop. Tools return authoritative
   structured data. The current TUI maps known results to trusted cards
   renderer-side; the model does not emit UI or workspace commands in this
   provisional slice. Narration explains results without copying tables, IDs,
   or amounts already rendered from the result object.

Writes always follow **draft → simulate → inspect → explicit approval →
sign → confirm**. The approval view is protocol-driven. It shows the
actual transaction group, sender, network, fees, and effects. TUI and
web differ only in the custody adapter (keystore versus wallet) and
renderer. Static navigation and direct lookup remain useful when the
model is absent or misbehaving.

Scope guards:

- Lora workflows and coverage are the shared experience target. Its
  component implementation is reference material, not a code-port
  requirement.
- The model selects trusted, versioned view recipes. It never generates
  UI code.
- Component sharing is selective. Share semantics, hooks, state, and view
  trees where they stay natural. Prefer two small renderers to a
  lowest-common-denominator abstraction.
- BYO key/local models are the launch auth story. Provider OAuth is
  opportunistic.
- x402 is an experiment, not a launch dependency.
- The protocol carries agent, result, presentation, and
  approval events. No critical flow can exist only inside one head's
  components.

## 10. State model

State is where v1 died (SQLite session store, per-network keyring drift,
`switch_account` bugs). These tools get embedded in four hosts. So this
section is normative.

**The invariant: every request carries its full context explicitly
(network, sender, and more).** Anything that "remembers" is a client that
is stateful by nature: a conversation, a process, a browser tab, a config
file. There is no shared mutable store that tools or servers read.
Ambient lookup of "current X" is banned.

| "Stateful" thing                | Owner                          | Mechanism                                                                             |
| ------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------- |
| Current network (MCP/agent)     | The conversation               | Agent passes `network` per call. Its context window is the session store.             |
| Current network (CLI/TUI)       | The local client process       | In-memory + human-readable config file. No db.                                        |
| Current network (web)           | The browser                    | URL param / localStorage. API stateless per request.                                  |
| Active wallet / sender          | Same per host                  | Tools take explicit `sender`. "Active account" is host-side sugar filling the param.  |
| Explorer open artifact          | The TUI process or browser tab | Plain client-local state over a titled trusted view. Never API ambient state.         |
| Key material & metadata         | keystore-node daemon           | OS keychain + sealed file. Not our state.                                             |
| Agent/skill/MCP config          | CLI config files               | Plain files, versionable                                                              |

**Per-request network selection** (Phase 3 opener): a deployment declares
`networks: [...]` (one default). Clients are pooled per network at
startup. The adapter injects a `network` parameter into tool schemas
**only when more than 1 network is served**, as a closed enum of exactly
the operator-configured networks. The agent chooses within the
operator's bounds. The agent never invents endpoints. **Optional with
default on read tools** (wrong-network reads are harmless and
self-evident). **Required on `requiresSigner` tools** (never spend on a
silently-defaulted chain). A `get_network` read tool lists served
networks + default so agents orient instead of guessing. Result: "current
network" ceases to exist as a stored fact anywhere. It lives only in
requests and in the conversation memory of user intent, which cannot
silently diverge.

**No shared application database.** The engine has none. Any future "we
need to store this" is a design smell until proven otherwise.
Client-local workspace persistence and hosted account/billing records
are allowed at their natural edges. Neither becomes ambient tool
context. Wallet pairing stays client-side.

## 11. Open questions

1. ~~Where do the API and Explorer heads live?~~ **Resolved (updated
   2026-08-19): API, TUI, web, SDK, and their shared experience packages live
   in `initlabsai/vibekit` beside the engine.** Apps are private terminal
   workspaces and independent deployment artifacts. They consume only public
   package exports. An out-of-workspace packed-package fixture, not a second
   first-party repo, proves the external boundary.
2. ~~Package naming~~ **Resolved (2026-08-15):** packages use the
   `@initlabs/vibekit-*` pattern.
3. ~~Testnet faucet~~ **Resolved (2026-08-16)**:
   `vibekit dispenser login` (device flow, `offline_access`) → token
   sealed in daemon secrets → `fund_testnet_account` tool,
   conditionally registered. Original question: v1's dispenser-testnet
   (Foundation faucet client. AlgoKit's equivalent is
   [`core/dispenser.py`](https://github.com/algorandfoundation/algokit-cli/blob/main/src/algokit/core/dispenser.py)).
   Resurrect as a tool, a CLI command, or drop?
4. ~~`app_deploy` semantics~~ **Resolved (2026-08-15): plain create on
   raw algosdk.** ARC-56/32 parsing, `TMPL_*` deploy-time substitution,
   algod compile, bare or ABI create. No idempotent AppFactory
   semantics: deploying again makes a new app. Agents that want update
   flows use `app_call` with the update OnComplete (future work if
   demanded).
5. ~~MCP SDK choice~~ **Resolved by spike (2026-08-11): official v2
   SDK** (`@modelcontextprotocol/server` 2.x). Its per-request factory
   model matches our per-request `ToolContext` exactly.
6. **Ecosystem tools** (`search_ecosystem` + 454-line static dataset):
   port as a plugin with the data externalized, or drop from the MCP and
   keep it API-side only?
7. ~~Minimum client protocol version~~ **Resolved by spike
   (2026-08-11)**: the v2 SDK bridges 2025-era clients by default
   (confirmed empirically with a v1-SDK client against our stateless
   server, both transports' default postures). No extra compat work.
   Today's agents are served.
8. ~~Module format~~ **Resolved:** packages are ESM-only. Reopen this only for
   a concrete CJS consumer rather than doubling the build and test surface
   speculatively.
9. **Keystore prerelease policy.** The algosdk half is resolved: 3.7.0 is
   stable, apps and development pin it exactly, and packages declare the
   `>=3.7.0 <4` peer range. Decide whether `keystore-node@1.0.0-canary.3` is
   acceptable at the 1.0 gate or whether release waits for its stable build.
10. **Docs site.** v1 has `apps/website` (Astro/Starlight,
    getvibekit.ai). Published packages for external developers _require_ docs
    (contract reference, plugin authoring guide, self-hosting guide). If the
    site returns, keep its source as a private app in this monorepo. Decide its
    framework, domain, and hosting before adding it to the target layout.
11. **License & copyright.** Package manifests currently declare
    Apache-2.0, but the repository has no root license file. Add it and settle
    copyright headers/`author` fields before the first npm publish. v1 is MIT
    © Gabriel Kuettel, so relicensing the ported code remains the copyright
    holder's call.
12. ~~Keystore UX gap~~ **Resolved (2026-08-16)**:
    `vibekit keystore <args>` (managed pinned install) + agent-facing
    `create_signing_account`/`list_signing_addresses`. Mnemonic flows
    stay with the CLI. Original question: **Keystore UX gap.** Deferring
    account CRUD to the `keystore` CLI assumes it is installed and its
    UX is acceptable for vibekit users. If canary UX is rough,
    `vibekit account …` thin aliases move from "maybe later" to launch
    scope. _Spike data point: CLI UX was solid
    (generate/list/export/sign/serve all clean). Leaning "defer to
    keystore CLI"._
13. ~~TUI distribution~~ **Resolved (2026-08-19):** `vibekit explore`
    launches the private `apps/tui` OpenTUI app as a separate process
    (workspace source, `dist`, or a sidecar binary; `VIBEKIT_EXPLORE`
    overrides). OpenTUI is not embedded in the compiled CLI. Packaging the
    sidecar next to published binaries remains a 1.0 install-channel task.
14. **Presentation protocol:** freeze `AgentEvent`, approval events,
    `ViewSpec`, and `WorkspaceCommand` only after the same recorded
    fixtures render and update correctly in OpenTUI and web. The §4.1
    constraints are locked. The exact schema is not.

## 12. Migration plan

Sequenced so each phase produces something runnable, and risk is
front-loaded:

- **Phase 0 — Spike (de-risk the then-beta dependencies).** Minimal stateless MCP on the
  2026-07-28 spec serving `network` + read-only `accounts` tools on raw
  algosdk 3.7 beta, plus one write tool (`send_payment`) signing through
  keystore-node's daemon. Throwaway code. Keep the learnings. _Exit
  criterion: an agent completes a testnet payment end-to-end through the
  new stack._ The spike must also answer these four questions.
  (a) Does a **current** agent client (Claude Code today) talk to the
  stateless server (open question 7)?
  (b) Does the keystore RPC socket work from a `bun build --compile`
  binary with no native addon linked in?
  (c) Does the bigint→JSON codec round-trip cleanly on real
  algod/indexer responses?
  (d) Does compose mode (unsigned group out, signature in) work
  end-to-end?

### Phase 0 results (2026-08-11) — ✅ all four verdicts passed

The throwaway implementation was removed after Phase 2. Its durable results
remain below and the code remains available in Git history.

| Verdict             | Result                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| (a) Client compat   | ✅ **Both** a modern 2026-07-28 client and a legacy 2025-era client (v1 SDK, initialize handshake) talked to the same stateless HTTP server. The official v2 SDK bridges legacy clients by default (`legacy: 'stateless'` on HTTP, `'serve'` on stdio. Bridged versions: 2025-11-25 … 2024-10-07). **Open questions 5 & 7 resolved**: use the official SDK. No extra compat work needed. |
| (b) Compiled binary | ✅ `bun build --compile` binary (95 MB) signed via the keystore daemon socket. The RPC-client import path pulls in no native addon.                                                                                                                                                                                                                                                      |
| (c) BigInt codec    | ✅ One `jsonSafe` codec (bigint→number-if-safe-else-string, bytes→base64) round-tripped real algod responses (testnet + localnet reads, account info, tx confirmation).                                                                                                                                                                                                                  |
| (d) Compose mode    | ✅ HTTP server (compose, no signer) returned a base64 `unsignedGroup`. The "wallet side" decoded, signed via keystore, submitted, confirmed. The hosted/browser write flow is viable.                                                                                                                                                                                                    |

**Exit criterion**: payment end-to-end through the new stack — ✅ on
**localnet** (keystore-daemon-signed via stateless MCP, confirmed round 108. Before/after balances confirmed). The literal _testnet_ run is
blocked only on funds: the AlgoKit testnet dispenser token is expired
(`vibekit dispenser login` to refresh). Testnet reads confirmed against
real nodes.

Implementation facts learned:

- **v2 SDK package names**: `@modelcontextprotocol/server` /
  `@modelcontextprotocol/client` (2.0.0). The v1 monolith
  `@modelcontextprotocol/sdk` is frozen at protocol 2025-11-25.
  `createMcpHandler(factory)` builds a fresh server per HTTP request
  (exactly our per-request `ToolContext` model). `serveStdio(factory)`
  ditto per connection. `registerTool` takes full Zod schemas (Zod 4
  works), annotations, and `_meta`. A tool's `view` travels as
  `_meta['ai.vibekit/view']`.
- **Contract**: a `defineTool()` identity helper is required for
  `z.infer` to flow into handler args (annotating
  `const x: ToolDefinition` erases inference), plus an `AnyTool` erased
  type for registries. Bake both into `@initlabs/vibekit-core`.
- **keystore-node canary held up**: generate/export/sign/list/serve all
  worked first try on Linux (Secret Service). Two adapter needs for
  `signer-keystore`: the daemon has no "list addresses". The adapter
  must build an address book by `export()`ing each key's public key
  (cache it). The RPC client holds the socket open. The adapter needs an
  explicit `close()` or CLI processes hang on exit. **Open question 12
  leaning**: keystore CLI UX was solid. Thin aliases can wait.
- **algosdk 3.7 beta (at spike time)**: `Transaction.bytesToSign()` +
  `attachSignature(addr, sig)` compose cleanly with `KeyStoreAPI.sign()`.
  `makePaymentTxnWithSuggestedParamsFromObject` / `waitForConfirmation`
  unchanged from v3 stable. No algokit-utils missed.
- **v1 bug found en route**: v1 MCP `switch_account` succeeds but
  `send_payment` then fails with "Account not found in keyring"
  (per-network keyring lookup mismatch). More evidence for the rewrite.
  No fix planned in v1.

- **Phase 1 — Skeleton.** Fresh repo, tsconfig/turbo/changesets/CI,
  `core` with the tool contract + signer hook + `NetworkClients`, `mcp`
  server library, `apps/mcp` reference deployment. ✅ **Done 2026-08-15**
  — initial commit in `~/Code/@initlabs/vibekit`:
  `@initlabs/vibekit-core` (contract + codec + network clients, 11 tests)
  and `@initlabs/vibekit-mcp` (one generic adapter, registry validation
  at startup, `./stdio` + `./http` entries, 7 in-memory round-trip
  tests). Reference deployment smoke-tested live against testnet.
  Contract refinement from implementation: `ToolPlugin` carries a
  pre-built `service` value (author-side factory captures config)
  instead of a host-invoked `createService(config)`. The host never
  holds plugin config.
- **Phase 2 — Port read tools.** network → accounts → assets →
  transactions(read) → contracts(read). Each domain lands with handler
  tests. Mostly mechanical: swap `AlgorandClient` context for raw
  clients (26 of about 38 call sites already reach through to raw
  algod/indexer). ✅ **Done 2026-08-15** — five packages, 23 tools, 51
  tests, all with output schemas + display hints. Reference deployment
  serves the full read surface, smoke-tested live on testnet. Notable
  findings: (1) algosdk defaults omitted client ports to **:8080**.
  `createNetworkClients` now always passes scheme-derived ports (the v1
  AGENTS.md papercut, now fixed structurally). (2) Named networks use
  nodely 4160 endpoints. Free-tier 429s forced paced block sampling (3
  concurrent, partial-failure tolerant) in `get_network_status`. (3)
  Deliberate behavior change vs v1: address-taking read tools now
  validate and throw `ToolError('INVALID_ADDRESS')` up front (v1
  surfaced raw indexer errors. In `batch_lookup_accounts` one invalid
  address now fails the call instead of being silently dropped). (4)
  v1's per-domain duplicated
  `formatAccount`/`formatTransaction`/`formatApplication` helpers were
  deduplicated into per-package `format.ts` modules with identical
  shaping.
- **Phase 3 — Write path.** Opens with per-request network selection (§10
  state model). Then: port `transactions/compose` onto algosdk's native
  composer. Write tools for assets/contracts/transactions.
  `signer-keystore` (walletconnect dropped). Resolve the `app_deploy`
  question. ✅ **Done 2026-08-15** — multi-network shipped exactly per
  §10 (pooled contexts, adapter-injected enum,
  optional-on-reads/required-on-writes, `get_network`). Compose engine
  in core on `AtomicTransactionComposer` (one path for plain txns + ABI
  method calls with transaction-typed args, execute/compose/simulate).
  13 write tools + 3 recovered reads across three packages.
  `@initlabs/vibekit-signer-keystore` with address-book cache +
  `close()`. Live E2E on localnet through the reference deployment:
  keystore-signed payment, asset creation, group simulation, app
  deploy. 100+ tests green. Repo now at 8 packages + reference app.
  **App-call policy (decided 2026-08-15):** the tools layer speaks raw
  algosdk (`ABIMethod` + `AtomicTransactionComposer`).
  [algokit-client-generator-ts](https://github.com/algorandfoundation/algokit-client-generator-ts)
  is build-time codegen for known contracts and cannot serve runtime
  specs (xArc, `resolveAppSpec`). Its generated clients depend on
  algokit-utils, which we dropped. We implement the needed ARC-56
  semantics ourselves (struct↔tuple mapping, probably default-argument
  resolution) using the generator + algokit-utils `AppClient` as
  reference implementations. The generator belongs in `vibekit new`
  project templates, where a developer builds against one known
  contract.
- **Phase 4 — Plugins.** `plugin-nfd` and `plugin-alpha-arcade` (applying
  REFACTOR.md §1's format fixes in the port). These prove the plugin
  contract. Publish everything under `@initlabs`. ✅ **Built 2026-08-15,
  publish deferred**: packages renamed `@initlabs/vibekit-*` (Q2
  resolved). Both plugins live-verified (1,146 markets, nf.algo). Repo
  pushed to `github.com/initlabsai/vibekit`. Publish metadata stamped
  and staged. **npm publish held for a 1.0 release** (owner's call:
  first public release must be 1.0-quality, roughly aligned with
  algosdk 3.7 stable). The earlier two-repo plan placed the release gate
  between Phases 6 and 7. **Superseded 2026-08-19:** first-party app work now
  proceeds in this monorepo through public exports and does not wait for npm
  publication. The 1.0 gate remains binding for external consumers and adds a
  packed out-of-workspace consumer fixture so workspace resolution cannot hide
  package defects.
- **Phase 5 — CLI.** Port init/agents/skills. Add localnet (from AlgoKit
  CLI reference) and template bootstrapping. ✅ **Done 2026-08-15** —
  `apps/cli` (`@initlabs/vibekit-cli`, private, bun-compiled binary like
  v1). Four command areas, all live-verified:
  (1) **`init`** ported from v1 and slimmed. Agent registry
  (claude/codex/copilot/cursor/opencode). MCP registry (vibekit local +
  kappa/context7 docs. GoPlausible dropped). Skills bundled at build
  time from `algorand-devrel/algorand-agent-skills` (10 skills).
  AGENTS.md rewritten for the v2 tool surface. Deleted relative to v1:
  Vault/keyring/WalletConnect provider phases, GitHub PAT, dispenser
  auth, AlgoKit install (about 2,000 LOC of v1 wizard). Agent MCP config
  now carries env
  `NETWORK=localnet, NETWORKS=localnet,testnet,mainnet, SIGNING=execute`.
  (2) **`new`** — tarball fetch from `codeload.github.com` +
  `tar --strip-components=1`. No git/npm. Interactive tier picker or
  `--template`. Verified live (contracts: 20 files).
  (3) **`localnet`** — sandbox.py's
  compose/conduit/algod-config/network-template generation ported
  verbatim (project `vibekit_localnet`, config in
  `~/.config/vibekit/localnet`, same host ports as AlgoKit so templates
  work unchanged). start/stop/reset(--update)/status/logs +
  `fund <addr>` via kmd (richest key in `unencrypted-default-wallet`).
  Deferred per MVP scope: podman, named instances, image-version cache,
  goal passthrough, codespaces. Verified E2E: start → health checks →
  status → fund 5 ALGO (confirmed on-chain) → stop.
  (4) **`mcp`** — stdio server importing `@initlabs/vibekit-mcp` as a
  library (v1's app→app dependency killed). Full 50-tool surface + both
  plugins. Execute mode via keystore daemon with a loud **fallback to
  compose** when the daemon is down (agents still get an MCP). 24 CLI
  tests (compose generation/staleness, config generation for all agent
  formats, toml, template args). Repo-wide turbo green.
- **Phase 6 — Orchestrator + TUI.** `@initlabs/vibekit-agent` (LLM
  provider abstraction via the AI SDK, tool loop, streaming, BYOM
  config) + `vibekit explore` running it in-process with the tool
  packages. This completes the dev stack with no hosting dependency. It
  also dogfoods the orchestrator before anything hosted exists. Display
  hints become terminal renderers. ✅ **Done 2026-08-15.**
  (1) **Refactor first**: deployment semantics (`resolveDeployment`,
  `injectNetworkParam`, `executeToolCall` — registry validation, pooled
  per-network contexts, §10 network-param injection, jsonSafe results)
  moved from `packages/mcp` into **core**. Then the MCP adapter and the
  orchestrator are two thin hosts over one implementation.
  (2) **`@initlabs/vibekit-agent`**: AI SDK **v7** (`streamText` +
  `stepCountIs` loop). BYOM `ProviderConfig` (anthropic / openai /
  openai-compatible / ollama) or any raw `LanguageModel` (mocks,
  middleware). `createAgent()` returns a session. In-memory message
  history (the conversation is the client's state, §10). `stream(input)`
  yields the **`AgentEvent` protocol**: text/reasoning deltas,
  tool-call, tool-result carrying the tool's `view` cue, error,
  finish+usage. Tool failures return `{ error: { code, message } }` to
  the model (loop continues) rather than throwing. 5 mock-model tests
  cover loop, network routing, ToolError surfacing, history.
  (3) **`vibekit explore`**: read tools + nfd/alpha-arcade plugins
  in-process, all three named networks (default mainnet, `--network`
  flag), first-run BYOM wizard persisting
  `~/.config/vibekit/config.json` (0600), REPL with `/new`, and
  display-hint renderers (table/account/asset/txn/markdown/json) in the
  CLI. Live-verified with Ollama (qwen3-8b-class local model): mainnet
  transaction queries with per-call `network` param, table rendering,
  NFD plugin resolution (nf.algo), and the same flows from the compiled
  binary (AI SDK bundles clean). Observation: small local models
  under-use specific tools (searched transactions instead of
  `get_network_status`). This is a model-quality issue, mitigated with a
  tool-selection line in the default system prompt. Hosted-quality
  models are the target for the API heads.
  **TUI upgraded to components (2026-08-16, owner's call):** the readline
  REPL became an **Ink** (React-for-terminal) app in the v1 brand (mint
  `#5de4c7`): `<Static>` chat scrollback, streaming markdown, tool chips
  with nested **result cards** (table/account/asset/txn views built from
  tool output + display hints — the answer surface, with an
  `extraInstructions` line telling the model not to restate rendered
  data), in-TUI model wizard + keystore account picker, and
  **approval-card signing**: `approveToolCall` (new orchestrator option)
  gates every `requiresSigner` call on an in-TUI y/n card. Connecting =
  picking a keystore-daemon account (no pairing state — the design's
  WalletConnect-less answer to "connect wallet"). Explore is thus look
  _and_ act locally. The §9 read-only scope guard is amended.
  Implementation notes: Ink needs `react-devtools-core` as a
  devDependency to compile into the bun binary (dormant at runtime).
  **Never mix clack prompts with Ink in one process.** Clack teardown
  leaves stdin unrecoverable for Ink, so explore is all-Ink (`setup.tsx`:
  SelectList/wizard/picker). E2E: keystore-signed 1 ALGO localnet
  payment requested in English, approved on the card, confirmed round 3.
  **TUI dropped (2026-08-16, owner's call, same day it shipped):** live
  use made the redundancy concrete. A `vibekit init` user already has
  these exact tools in a better harness with a better model and
  harness-native write approval. Offline/local-model exploration is
  served by any local harness (for example pi) + Ollama over
  `vibekit mcp`. BYOM-local models also proved weak at 50-tool recall
  (mitigated with a tool-name index in the default system prompt, but
  the ceiling is the model, not the UI). The TUI code is deleted (git
  history keeps it). `vibekit agent` reserves the entry point and
  launches the web VibeKit Agent when Phase 8 ships. **What survives,
  and why Phase 6 still paid for itself:** the orchestrator (untouched,
  the Phase 7–8 engine), `approveToolCall` (the web approval card),
  `extraInstructions`, the don't-restate-rendered-results pattern, the
  microALGO prompt fix, and the tool-index fix. Four real bugs caught
  before anything hosted exists.
- **Phase 7 — API + SDK + protocol spine.** Add `apps/api` and
  `packages/sdk` in this monorepo. The API is a thin Hono wrapper over the
  proven orchestrator (BYOM + per-request tool selection). Build the new SDK with
  registry-derived types. Establish the minimal browser-safe agent, result,
  presentation, and approval event spine in
  `packages/experience`, driven by the first fixture-backed slice. Keep
  presentation details provisional until both renderers prove
  them. Deprecate `@getvibekit/sdk`. **Experience checkpoint 2026-08-19:** the
  fixture-backed result/presentation/approval subset, the
  write flow (draft → simulate → inspect → approval → sign → confirm as
  protocol events over a pure reducer), both renderers, the live
  compose/simulate wiring (real localnet groups through `executeToolCall`, an
  `AgentEvent` tool-result mapper, and a provisional signerless web route
  standing in for the API), and keystore-daemon signing with real on-chain
  confirmation in the TUI are implemented and tested; the hosted API, SDK,
  browser wallet custody, hosted API agent loop, and SDK remain pending.
- **Phase 8 — Shared TUI/web Explorer.** The first fixture-backed vertical
  slice is complete: direct transaction lookup → trusted detail view → related
  navigation → payment draft/simulation/approval. Both renderers use the
  shared experience package, with renderer-native primitives and a TUI-local
  feed controller. Expand toward broader domain coverage, browser wallet
  custody, xArc, and CLI terminal packaging afterward. **Checkpoint
  2026-08-19:** both renderers open the fixture
  transaction, dispatch related focus commands, and drive the payment
  draft/simulation/inspection/approval flow from the shared experience
  package — against fixtures and against a live localnet, with the actual
  unsigned group bytes on the approval view. The TUI completes the write
  path: keystore-daemon signing after the recorded approved decision, then
  submission and a real on-chain confirmation (field-verified, localnet
  rounds 22–23). No `packages/views-react` extraction was earned because the
  small transaction and flow trees remained clearer with platform-native
  primitives. The Phase
  6 transcript-oriented Ink TUI remains deleted. This is
  a different product shape. Archive the old vibekit repo after cutover.

## 13. Reference: what dies from v1

| v1                                                                         | Fate                                                                                               |
| -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| 3 tool-definition shapes, 6 adapter loops                                  | 1 contract, 1 adapter per host                                                                     |
| 4-place tool-name registry                                                 | 1 registry, everything derives                                                                     |
| `provider-*`, `keyring`, `dispenser-*`, `config` (9 pkgs, about 1,900 LOC) | → `signer-keystore` + localnet module (WalletConnect dropped — client-side in the explorer, later) |
| mcp-server `account-service.ts` + `app-state.ts` (1,119 LOC)               | → per-request `ToolContext` + keystore daemon                                                      |
| algokit-utils                                                              | → raw `algosdk@3.7.0`                                                                              |
| CLI vault module (about 500 LOC)                                           | deleted                                                                                            |
| regex `.d.ts` type-sync in sdk                                             | → types derived from Zod registry                                                                  |
| 3 tsconfig conventions, 9 copy-pasted tsconfigs                            | 1 base config                                                                                      |
| 0 tests                                                                    | tests required per ported domain                                                                   |

## 14. References

**MCP (stateless spec)**

- [2026-07-28 spec release announcement](https://blog.modelcontextprotocol.io/posts/2026-07-28/)
- [2026-07-28 changelog — key changes](https://modelcontextprotocol.io/specification/2026-07-28/changelog)

**Signing & custody**

- [wallet-provider repo](https://github.com/algorandfoundation/wallet-provider) · [TUTORIAL.md](https://github.com/algorandfoundation/wallet-provider/blob/main/TUTORIAL.md) (provider/extension/store architecture)
- [wallet-provider-extensions repo](https://github.com/algorandfoundation/wallet-provider-extensions) — `keystore/node` directory is the source of `@algorandfoundation/keystore-node`
- [`@algorandfoundation/keystore-node` on npm](https://www.npmjs.com/package/@algorandfoundation/keystore-node) — the repository pins `1.0.0-canary.3` exactly

**Chain SDK & post-quantum**

- [js-algorand-sdk repo](https://github.com/algorand/js-algorand-sdk) — this repository pins stable `algosdk@3.7.0`
- [Algorand post-quantum roadmap](https://algorand.co/blog/algorand-post-quantum-cryptography-roadmap) — background for Falcon account support

**App calls / ARC-56 (reference for Phase 3)**

- [algokit-client-generator-ts](https://github.com/algorandfoundation/algokit-client-generator-ts) — reference implementation of ARC-56 semantics (structs, default args). Used in templates only, never a tools-layer dependency.

**Starter templates**

- [algorand-starter-contracts](https://github.com/initlabsai/algorand-starter-contracts) · [-fullstack](https://github.com/initlabsai/algorand-starter-fullstack) · [-kitchensink](https://github.com/initlabsai/algorand-starter-kitchensink) — public template repos, additive tiers
- [algorand-starter-templates](https://github.com/initlabsai/algorand-starter-templates) — private dev monorepo (single source of truth. Sync subdirs → template repos on change.)

**AlgoKit CLI (reference for re-implementation)**

- [algokit-cli repo](https://github.com/algorandfoundation/algokit-cli)
- Localnet: [`src/algokit/cli/localnet.py`](https://github.com/algorandfoundation/algokit-cli/blob/main/src/algokit/cli/localnet.py) (commands) · [`src/algokit/core/sandbox.py`](https://github.com/algorandfoundation/algokit-cli/blob/main/src/algokit/core/sandbox.py) (Docker Compose orchestration)
- Testnet dispenser: [`src/algokit/core/dispenser.py`](https://github.com/algorandfoundation/algokit-cli/blob/main/src/algokit/core/dispenser.py)

**Explorer**

- [Lora](https://github.com/algorandfoundation/algokit-lora) — workflow, domain-coverage, and interaction reference
- [OpenTUI](https://github.com/anomalyco/opentui) — terminal renderer. Use its React reconciler for the TUI head.
- [Beautiful UI](https://www.beautifului.dev) — copy-paste AI-native primitives (streaming text, thinking traces, tool chips, approval cards, chat composer) by Turbo. Design language for the new Explorer.
- [ARC-56 spec](https://github.com/algorandfoundation/ARCs/blob/main/ARCs/arc-0056.md) — the app-spec format behind `toolsFromArc56` and the xArc feature

**v1 carryover**

- `REFACTOR.md` in the v1 repo — §1 (raw numbers from alpha-arcade format functions) applies during the plugin-alpha-arcade port. §2 already re-landed in v1 (`67d49c0`). §3 is moot after the rewrite.
