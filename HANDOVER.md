# Handover — Explorer parity arc (written 2026-08-22)

For the next coding agent, whatever harness you are. Read `AGENTS.md` first
(the operational contract — gates, rules, style), then the two blocks in
`docs/DESIGN.md`: "Consolidation workstreams" (done, context) and
"Explorer parity workstreams" (this arc, L0–L6 with per-phase status).
This file is working state only; once you have absorbed it and updated
DESIGN.md's status marks, delete it — `docs/` deliberately holds exactly
DESIGN.md and CONSTITUTION.md.

## Where the arc stands

Everything through L1 is committed and green:
- L1 flow graph: model in `packages/experience/src/views/transaction-graph.ts`
  (mirrors algokit-lora's verticals/horizontals/representations; corpus of
  real recorded wires in `packages/experience/test/recorded/mainnet-graph-corpus.json`
  — note two groups are testnet; entries carry `network`), TUI card in
  `apps/tui/src/cards/transaction-graph{-layout}.ts(x)` (`v` toggles
  graph/table on group cards), and formatter wire-gap fixes (freeze, asset
  config, created ids, signer) with group/list records retaining nested
  `innerTxns`.
- Also landed: `vibekit explore setup` (persists provider/model to
  `~/.config/vibekit/config.json`; API keys stay in env) and the
  `zerosignal` provider in `packages/agent` (probe + model-catalog helpers).

**L2 (My Apps) may be complete, partially complete, or untouched — check
`git log` and `git status`.** L2's scope: ARC-56/ARC-32/ARC-4 spec
normalization helpers in the tools contracts domain (plain algosdk + zod;
do NOT add algokit-utils); a depth-limited cwd scan for spec files in an
apps/tui slice (local specs are rescanned each launch, never persisted);
a My Apps screen (deployed associations persist under an `apps` section in
the vibekit config file, keyed by network — helpers beside the agent
section in `packages/agent/src/config.ts`); `.algo` names recognized by
`packages/experience/src/core/classifier.ts` as
`{ kind: 'entity', entity: 'account-name' }` and resolved in the TUI
lookup slice via `@initlabs/vibekit-plugin-nfd`. If the tree holds
uncommitted L2 work, finish it against that spec, run the full gate, and
commit; do not revert partial work — this repo's history shows completing
interrupted trees works cleanly.

## Next phases (owner-approved; do not re-ask scope)

- **L3 — `toolsFromArc56(spec)`**: app spec → runtime `ToolDefinition[]`
  (the "xArc seed" already promised in DESIGN.md; lives in the tools
  contracts domain). Call interface in the TUI for read methods +
  signerless simulate (compose mode already supports it). ABI decoding
  wherever a My Apps spec is known: fills the graph model's empty
  `methodName` label slot, and decodes args/returns on cards. Plain
  algosdk (`ABIMethod`, ATC) has everything needed.
- **L4 — write-flow generalization**: replace the payment-only
  interception at `packages/experience/src/agent-lane.ts` (the
  `toolName === 'send_payment'` check) with shape-based interception —
  any `requiresSigner` tool whose output parses as core's
  `UnsignedGroupResult`. Generalize the flow records in
  `packages/experience/src/flows/` from payment facts to group facts,
  and render the L1 graph inside the TUI approval modal
  (sign-what-you-see — this deliberately exceeds Lora). The flow
  machine/reducer itself needs no changes; it carries only references.
- **L5 — TUX shakedown**: drive the real TUI in tmux (send keys, capture
  panes) through scripted journeys: unconfigured first run → setup →
  chat; paste txid; full payment approval; every card type via fixtures
  (offline mode works); narrow-terminal collapse; focus/keybar per mode.
  Gotcha: opentui outlives plain SIGTERM — use `timeout -k`. Triage
  findings, fix, re-walk; leave feel/color judgments to the owner.
- **L6 — live data**: algod wait-for-block tail feed (latest
  blocks/transactions + live entity activity).

## Gates and conventions (non-negotiable)

- Before every commit: `bunx turbo run build typecheck test` green, plus
  `bun run verify:packed` (packs all publishable packages and builds an
  out-of-workspace consumer) whenever package exports/manifests/types
  changed. Suite size at handover: 415 tests.
- Every Explorer feature lands renderer-independent in
  `packages/experience` before its first renderer (TUI first; the web
  head later re-renders the same models).
- No new packages, registries, or protocol layers without a named
  existing consumer plus owner sign-off (AGENTS.md "abstraction budget").
- Conventional commits; the rest of the style rules are in AGENTS.md.

## Owner still owes the arc

- A real ARC-56 spec from one of his projects (L3 test material; algokit
  sample specs are the stopgap).
- The human UX pass at the end of L5.
- Phase-7 note already in DESIGN.md: investigate ZeroSignal's
  browser-native (passkey) path as the hosted web Explorer's inference
  story.
