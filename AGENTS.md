# AGENTS.md

The map of this repository, for people and coding agents alike. `README.md`
is the product page. Read `docs/CONSTITUTION.md` before structural changes.

VibeKit exposes Algorand capabilities through one tool contract across MCP,
CLI, and an LLM agent loop, and ships an Explorer (terminal and web) that
renders what those tools return.

## What runs where

| Path | What it is |
| --- | --- |
| `packages/vibekit` | The one published package, `@initlabs/vibekit`. Every `src/` area is a subpath export. |
| `packages/vibekit/src/core` (`.`) | The tool contract, `resolveDeployment`, `executeToolCall`, the codec, and the compose engine (`core/compose/`). |
| `packages/vibekit/src/tools` (`./tools`, `./tools/views`) | The domain tools: accounts, assets, contracts, network, transactions — each a flat directory of `index.ts` (the tool definitions), `schemas.ts`, and the functions behind them. `views.ts` maps each view id to its wire schema. |
| `packages/vibekit/src/plugins/*` (`./plugins/<name>`) | Third-party tool plugins: nfd, pera, vestige, alpha-arcade. |
| `packages/vibekit/src/signer-keystore` (`./signer-keystore`) | The algosdk signer over the keystore daemon, its account tools, the testnet dispenser. |
| `packages/vibekit/src/mcp` (`./mcp`, `./mcp/stdio`, `./mcp/http`) | Host: ToolDefinition-to-MCP adapter and transports. |
| `packages/vibekit/src/agent` (`./agent`, `./agent/config`) | Host: the LLM tool loop and its stored config. |
| `packages/vibekit/src/preset` (`./preset`) | The stock tool and plugin mix every stock host composes from. |
| `packages/vibekit/examples` | Reference stdio and HTTP deployments, typechecked with the package. |
| `apps/cli` | The `vibekit` binary: `new`, `init`, `localnet`, `keystore`, `dispenser`, `doctor`, `tool`, `mcp`, `explore`. Host: `commands/tool.ts` and `commands/mcp.ts`. |
| `apps/tui` | The terminal Explorer (OpenTUI). Live against a network when reachable, sample data otherwise. `features/<name>/` holds one feature's hooks, screen, and cards; `feed/` is the transcript; `app.tsx` composes them. |
| `apps/agent` | The web Explorer with its agent (Next.js). Sample-backed reads plus a compose-only flow route. |
| `apps/website` | The public site (Astro/Starlight). |
| `skills/` | Canonical skills, compiled into the CLI by `bun run --cwd apps/cli bundle-skills`. `.agents/skills`, `.claude/skills`, `.grok/skills` are symlinks into it. |
| `verify/` | The packed-consumer gate (`bun run verify:packed`). The LocalNet smoke is `apps/cli/scripts/smoke-localnet.ts` (`bun run smoke:localnet`, needs `vibekit localnet start`; CI runs it). |
| `test-prompts/` | Agent-run MCP acceptance prompts and their transcripts. |
| `ideas/` | Dated design notes that are not yet work. |
| `out/` | Marketing video build output (see the `marketing-content` skill). |
| `docs/` | `CONSTITUTION.md` and `PRODUCTION.md` only. |

Tests mirror `src/` under each package's `test/`. Apps consume packages only
through their public exports (`workspace:*`); packages never depend on apps.

## How a call flows

Read:

```
host (mcp | agent | cli tool) → executeToolCall(deployment, tool, args)
  → picks the network context → tool.handler(ctx, args) → jsonSafe()
  → output schema check → wire result
Views: wire → build*Record (packages/vibekit/src/views) → StructuredResult
  → ViewSpec → create*ViewModel → card (apps/tui/src/features/*/cards.tsx)
```

Write:

```
tool.handler → composeOrExecute(ctx, TxnSpec[]) (core/compose)
  → compose mode: unsigned group, base64 | execute mode: sign, send, confirm
Explorer action flow: draft → simulate → inspect → approve → sign → confirm
  (packages/vibekit/src/actions; every stage is a recorded result)
```

Every host sends calls through `executeToolCall` in
`packages/vibekit/src/core/deployment.ts`, which validates the arguments
against the tool's schema whatever the host parsed. Resolved contexts are
frozen before handlers receive them. Local file reads are a capability the
host grants (`readFile`); remote hosts leave it unset. Tools return structured data and declare a
`view` id; they never return JSX, HTML, or terminal markup.

## Glossary

One word per concept. Do not introduce a synonym.

- **tool** — a `ToolDefinition`: name, description, Zod parameters, optional
  output schema, flags, `view`, handler.
- **deployment** — a configured set of tools and plugins over one or more
  networks, in execute or compose mode, with an optional signer.
- **host** — a process that runs tool calls through `executeToolCall`: the
  MCP server, the agent loop, `vibekit tool`. In `packages/vibekit/src/views`, a
  `*Host` interface is the backend an Explorer app calls for results
  (`LiveHost`, the fixture host).
- **core** — `packages/vibekit/src/core`. Not "kernel" or "engine".
- **compose engine** — `core/compose/`: `TxnSpec[]` to a transaction group.
- **compose mode / execute mode** — return the group unsigned / sign and send.
- **plugin / service** — a `ToolPlugin` and the client it puts at
  `ctx.services[name]`.
- **preset** — the stock tool and plugin mix.
- **result** — a `StructuredResult`: the versioned envelope around one tool
  call's `data`. Builders are named `build*Record`; that is the same thing.
- **wire shape** — the post-`jsonSafe` JSON a tool returns; what output
  schemas and `viewDataSchemas` describe.
- **view id** — the dotted string a tool declares (`transaction.detail`).
  **ViewSpec** binds a trusted view id to a result reference. A **view
  model** is what `create*ViewModel` derives from the store for a ViewSpec.
  A **card** is the TUI component that renders one.
- **action flow** — the draft/simulate/inspect/approve/sign/confirm state
  machine in `packages/vibekit/src/actions`. The code still says "payment"
  in places; it carries app calls and groups too.
- **agent lane / direct lane** — in the TUI, whether input went to the
  model or was routed deterministically (an id, a command). The only uses
  of "lane".
- **keystore daemon** — `keystore serve` from `@algorandfoundation/keystore-node`;
  the only thing that holds keys. The ZeroSignal proxy is a different daemon.
- **skill** — a bundled skill (`skills/`, compiled in) or a catalog skill
  (a pinned remote repo in `apps/cli/src/skills/catalogs.ts`).
- **app spec** — an ARC-56 (or normalized ARC-32/4) JSON spec.
- **My Apps / known apps** — the TUI's list of locally deployed contracts
  with specs / the hardcoded mainnet app-id-to-label map.

## Rules

- Define every tool with `defineTool()`. Do not add a second handler shape.
- Do not keep module-level mutable state. Handlers read everything from
  `ToolContext`; they do not mutate it.
- Tool handlers throw `ToolError` with a code. Do not return `{ error }` from a
  handler. A host adapter may translate a thrown error into its own wire shape.
- Describe the wire shape in output schemas after `jsonSafe`. Bigints become
  a number or a decimal string. Bytes become base64.
- Land tests with code. Run `bunx turbo run build typecheck test` before a
  commit. Tests are type-checked; a test that references a field the type
  lacks fails typecheck.
- Tool and plugin packages declare `algosdk`, Zod, and
  `@initlabs/vibekit` as peer dependencies. Keep the repository's
  `algosdk` development/runtime version pinned exactly and the keystore canary
  dependencies pinned exactly. Ask before adding a dependency.
- Use conventional commits. Do not add co-author lines.
- Dependencies point inward: `core ← tools / plugins / signer-keystore ←
  hosts (mcp, agent, cli) ← apps`, and `explorer ← apps`. Never the
  reverse. `packages/vibekit/test/repo-rules.test.ts` pins this and the
  comment rule below.
- Keep core small. Add a new capability as a new tool or a thin host
  adapter. Do not add a new path around `executeToolCall`.
  - Share one factory for host wiring. Do not copy the tool and plugin mix into
    another host.
  - If a write needs a side path around `packages/vibekit/src/core/compose/`,
    stop.
- Package and layer additions are design smells until proven otherwise. A new
  package, protocol, registry, or extension point needs a named consumer that
  exists today plus owner sign-off; a consumer that might exist later is not
  a consumer. Prefer a plain function over a registry and an existing package
  over a new one. When an architecture instinct and a measured line-count
  disagree, the line-count wins (`docs/CONSTITUTION.md`).
- Apps are private workspaces and independent deployment artifacts. They
  import `@initlabs/*` through public exports using `workspace:*`; no relative
  or private cross-package imports. Packages never depend on apps.
- Shared Explorer state and protocol live in `@initlabs/vibekit/views` and `/live`; rendering
  primitives live in their apps. `bun run verify:packed` builds the
  out-of-workspace consumer from packed tarballs; run it after any change to
  package exports, manifests, or public types.
- Comments describe the code as committed. No plans, phases, milestone
  labels, "provisional", or references to earlier versions of the product.
  Comment why, constraints, and edges that look like bugs. Do not narrate.
  Do not delete those comments.
- A new file is named for what it contains, not for the layer it sits in.
- Put JSDoc only on the public/exported `@initlabs/*` surface. Put tool
  descriptions on `ToolDefinition` and Zod `.describe()`.
- If a skill tells an agent to skip a gate, treat that as a bug. Update the
  skill, generated AGENTS.md templates, and system prompts with the gate.
- Skills ship in two tiers. Bundled skills live in `skills/` and compile
  into the CLI. Remote catalogs (third-party skill repos) are declared in
  `apps/cli/src/skills/catalogs.ts`, each pinned to a reviewed commit SHA and
  fetched as a codeload tarball at init time — codeload has no unauthenticated
  rate limit, so no GitHub token is required for public catalogs. Never point
  a catalog `ref` at a branch. To bump a pin: review the new upstream content,
  then update `ref` and the `skills` list together in one commit.
- Treat `skills/` as a product surface. When a VibeKit feature, contract,
  client, or workflow changes, update every affected bundled skill in the
  same change. Skills are normative: describe shipped behavior only, not
  plans or in-flight implementation. Do not restore AlgoKit-coupled guidance
  unchanged.
- Keep `skills/` as the only content source. When its inventory changes, update
  the relative discovery symlinks and their tests; do not duplicate canonical
  files under an agent-specific directory.
- Keep `docs/` small. `CONSTITUTION.md` owns purpose, the bets, and how work
  is judged; `PRODUCTION.md` holds dated shipping notes. Do not add a parallel
  handover or review ledger.
- Do not use "It's not X, it's Y" or other marketing cadence in comments or
  docs.

## Releasing

Versions come from Changesets. The repository is in pre-release mode
(`.changeset/pre.json`, tag `alpha`), so `changeset version` produces
`1.0.0-alpha.N` and increments N on each run.

`packages/vibekit` is the only package that publishes to npm. The CLI, TUI,
Explorer, and web apps are private: Changesets versions them so
`vibekit --version` matches the release tag, but never publishes them. They
ship as GitHub Release binaries.

1. `bunx changeset` — record the change, one bump level per package.
2. `bunx changeset version` — bumps manifests and writes CHANGELOGs. Never
   hand-edit a version.
3. `bun install` — required, not optional. `changeset version` leaves
   `bun.lock` stale and `bun pm pack` resolves `workspace:*` from the
   lockfile, so skipping this publishes a package whose dependencies point at
   versions that do not exist.
4. `bunx turbo run build typecheck test`
5. `bun run verify:packed` — run before every publish.
6. Commit, then tag `v<version>` and push the tag.
   `.github/workflows/release.yml` builds the CLI and the Explorer sidecar for
   four platforms and attaches them to the release. A tag containing a hyphen
   is published as a prerelease.
7. `bunx changeset publish` — needs npm auth first. In pre mode Changesets
   applies the `alpha` dist-tag itself; passing `--tag alpha` is rejected.

Before the first stable release run `bunx changeset pre exit`, then publish
with `bunx changeset publish` and no `--tag`.

Each platform's sidecar builds on its own OS. OpenTUI ships a native library
per platform, so the release matrix does not cross-compile.

## Docs

- `docs/CONSTITUTION.md` — why the project exists, the bets it rests on, and
  how work is judged; read it before structural changes
- `docs/PRODUCTION.md` — open decisions, traps, and deferred work
