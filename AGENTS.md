# AGENTS.md

This is the operational contract for coding agents. `README.md` is
human-facing and is not prerequisite reading; open it only when changing public
project documentation. Read `docs/DESIGN.md` before structural changes.

VibeKit exposes Algorand capabilities through one shared tool contract across
MCP, CLI, and the agent loop. This monorepo owns the engine, its reusable
packages, and the official hosted API and shared TUI/web Explorer apps. Apps
consume the public package surface and remain independent build and deployment
units.

## Architecture

Every tool is a `ToolDefinition`. A `ToolDefinition` has Zod parameters, an
output schema, and a handler. It may declare a semantic Explorer `view` id;
the explorer registry decides which ids are trusted.

A deployment is a configured set of tools. It selects networks, execute or
compose mode, and an optional signer.

Every host sends calls through `executeToolCall` in
`packages/core/src/deployment.ts`. Hosts include the MCP server, agent loop,
and CLI. `executeToolCall` selects the network context, makes results
JSON-safe, and enforces output schemas. Resolved contexts and their service
registries are frozen before handlers receive them.

Write tools build transaction groups in `packages/core/src/compose/`. In
execute mode the host signs and sends the group. In compose mode the host
returns the group unsigned.

Explorer presentation is a separate, versioned protocol under
`packages/explorer`. Tools return structured data. Tools never return JSX,
HTML, or terminal markup.

## Layout

- `packages/core` — contract, deployment, codec, compose engine
- `packages/tools` — the domain tools (accounts, assets, contracts, network,
  transactions) as per-domain exports from one package
- `packages/plugin-*` — third-party tool plugins
- `packages/signer-keystore` — keystore daemon signing, testnet dispenser
- `packages/mcp` — ToolDefinition-to-MCP adapter for stdio and HTTP
- `packages/mcp/examples` — reference stdio and HTTP deployments
- `packages/agent` — LLM tool loop
- `packages/explorer` — provisional browser-safe Explorer protocol, fixtures,
  workspace state, and semantic view models
- Planned packages: `views-react` for selected semantic React composition and
  `sdk`
- `apps/cli` — the `vibekit` binary
- Private apps: `tui` (OpenTUI) and `web` (Next.js) are fixture-backed
  renderers; `website` (Astro/Starlight) is the public site; `api` remains
  planned
- `verify/` — the packed-consumer gate and its fixture (`bun run verify:packed`)
- `skills/` — canonical vendored skills, compiled into the CLI at build time
  by `bun run --cwd apps/cli bundle-skills`
- `.agents/skills`, `.claude/skills`, and `.grok/skills` — Git-tracked relative
  symlinks into `skills/` for local agent discovery
- `test-prompts/` — agent-run acceptance tests
- `docs/` — exactly the two canonical design documents listed below

## Rules

- Define every tool with `defineTool()`. Do not add a second handler shape.
- Do not keep module-level mutable state. Handlers read everything from
  `ToolContext`; they do not mutate it.
- Tool handlers throw `ToolError` with a code. Do not return `{ error }` from a
  handler. A host adapter may translate a thrown error into its own wire shape.
- Describe the wire shape in output schemas after `jsonSafe`. Bigints become
  a number or a decimal string. Bytes become base64.
- Land tests with code. Run `bunx turbo run build typecheck test` before a
  commit.
- Tool and plugin packages declare `algosdk`, Zod, and
  `@initlabs/vibekit-core` as peer dependencies. Keep the repository's
  `algosdk` development/runtime version pinned exactly and the keystore canary
  dependencies pinned exactly. Ask before adding a dependency.
- Use conventional commits. Do not add co-author lines.
- Keep the kernel small. Add a new capability as a new tool or a thin host
  adapter. Do not add a new path around `executeToolCall`.
  - Share one factory for host wiring. Do not copy the tool and plugin mix into
    another host.
  - If a write needs a side path around `packages/core/src/compose/`, stop.
- Package and layer additions are design smells until proven otherwise. A new
  package, protocol, registry, or extension point needs a named consumer that
  exists today plus owner sign-off; "a future head might need it" is not a
  consumer. Prefer a plain function over a registry and an existing package
  over a new one. When an architecture instinct and a measured line-count
  disagree, the line-count wins (`docs/CONSTITUTION.md`).
- Keep official API/TUI/web apps here as private terminal workspaces and
  independent deployment artifacts. They import `@initlabs/*` through public
  exports using `workspace:*`; no relative or private cross-package imports.
  Packages never depend on apps.
- Put shared Explorer state/protocol in `packages/explorer` and selected
  React composition in `packages/views-react`. Keep renderer primitives in
  their apps. `bun run verify:packed` builds the out-of-workspace consumer
  from packed tarballs; run it after any change to package exports,
  manifests, or public types.
- If a skill tells an agent to skip a gate, treat that as a bug. Update the
  skill, generated AGENTS.md templates, and system prompts with the gate.
- Skills ship in two tiers. Vendored skills live in `skills/` and compile
  into the CLI. Remote catalogs (third-party skill repos) are declared in
  `apps/cli/src/skills/catalogs.ts`, each pinned to a reviewed commit SHA and
  fetched as a codeload tarball at init time — codeload has no unauthenticated
  rate limit, so no GitHub token is required for public catalogs. Never point
  a catalog `ref` at a branch. To bump a pin: review the new upstream content,
  then update `ref` and the `skills` list together in one commit.
- Treat `skills/` as a product surface, not ancillary documentation. When a
  VibeKit feature, contract, client, or workflow changes, update every affected
  vendored skill in the same change. Skills are normative: describe shipped
  behavior only, not plans or in-flight implementation. Do not restore
  AlgoKit-coupled guidance unchanged.
- Keep `skills/` as the only content source. When its inventory changes, update
  the relative discovery symlinks and their tests; do not duplicate canonical
  files under an agent-specific directory.
- Comment why, constraints, and edges that look like bugs. Do not narrate.
  Do not delete those comments.
- Put JSDoc only on the public/exported `@initlabs/*` surface. Put tool
  descriptions on `ToolDefinition` and Zod `.describe()`.
- Keep exactly `DESIGN.md` and `CONSTITUTION.md` under `docs/`. Fold durable
  architecture, current state, gaps, and roadmap into `DESIGN.md`. Fold
  durable rationale and governance into `CONSTITUTION.md`.
- Do not use "It's not X, it's Y" or other marketing cadence in comments or
  docs.

## Releasing

Versions come from Changesets. The repository is in pre-release mode
(`.changeset/pre.json`, tag `alpha`), so `changeset version` produces
`1.0.0-alpha.N` and increments N on each run.

Every non-private package under `packages/` publishes to npm. The CLI, TUI,
Explorer, and web apps are private: Changesets versions them so
`vibekit --version` matches the release tag, but never publishes them. They
ship as GitHub Release binaries.

1. `bunx changeset` — record the change, one bump level per package.
2. `bunx changeset version` — bumps manifests, rewrites the `@initlabs` peer
   ranges, writes CHANGELOGs. Never hand-edit a version or a peer range.
3. `bun install` — required, not optional. `changeset version` leaves
   `bun.lock` stale and `bun pm pack` resolves `workspace:*` from the
   lockfile, so skipping this publishes packages whose dependencies point at
   versions that do not exist.
4. `bunx turbo run build typecheck test`
5. `bun run verify:packed` — run before every publish.
6. Commit, then tag `v<version>` and push the tag.
   `.github/workflows/release.yml` builds the CLI and the Explorer sidecar for
   four platforms and attaches them to the release. A tag containing a hyphen
   is published as a prerelease.
7. `bunx changeset publish --tag alpha` — needs `npm login` first.

Before the first stable release run `bunx changeset pre exit`, then publish
with `bunx changeset publish` and no `--tag`.

Each platform's sidecar builds on its own OS. OpenTUI ships a native library
per platform, so the release matrix does not cross-compile.

## Docs

- `docs/DESIGN.md` — canonical architecture, current state, gaps, and roadmap;
  read it before structural changes
- `docs/CONSTITUTION.md` — why the project exists and how work is judged
