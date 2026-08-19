# AGENTS.md

VibeKit lets AI agents work with Algorand: query the chain, manage assets,
deploy and call contracts, sign through a local keystore daemon. It ships as
an MCP server, a CLI, and published `@initlabs/*` packages. The hosted API and
web agent live in a separate repo (`initlabs/vibekit-agent`) and consume these
packages from npm.

## Architecture

Every tool is a `ToolDefinition` (zod parameters, output schema, handler).
A deployment is a configured set of tools: which networks, execute or compose
mode, signer or not. Every host (MCP server, agent loop, CLI) funnels calls
through `executeToolCall` in `packages/core/src/deployment.ts`, which picks
the network context, makes results JSON-safe, and enforces output schemas.
Writes build transaction groups in `packages/core/src/compose/`, then either
sign and send (execute mode) or return them unsigned (compose mode).

## Layout

- `packages/core` — contract, deployment, codec, compose engine
- `packages/tools-*` — the tools, one package per domain
- `packages/plugin-*` — third-party tool plugins
- `packages/signer-keystore` — keystore daemon signing, testnet dispenser
- `packages/mcp` — ToolDefinition-to-MCP adapter (stdio and HTTP)
- `packages/agent` — LLM tool loop
- `apps/cli` — the `vibekit` binary; `apps/mcp` — reference deployment
- `skills/` — agent skills bundled into the CLI
- `test-prompts/` — agent-run acceptance tests
- `docs/` — design docs (see index below)

## Rules

- Every tool is a `ToolDefinition` via `defineTool()`. No bespoke handler shapes.
- No module-level mutable state. Handlers get everything from `ToolContext`.
- Throw `ToolError` with a code. Never return `{ error }` shapes.
- Output schemas describe the wire shape after `jsonSafe`: bigints become
  number or decimal string, bytes become base64.
- Tests land with code. `bunx turbo run build typecheck test` before commits.
- Tool packages take `algosdk`, `zod`, and `@initlabs/vibekit-core` as peer
  deps. Pin `algosdk@beta` and the keystore canary exactly. Ask before adding
  dependencies.
- Conventional commits. No co-author lines.

## Docs

- `docs/DESIGN.md` — canonical design; read before structural changes
- `docs/CONSTITUTION.md` — why the project exists, how work is judged
- `docs/HANDOVER.md` — current state, known gaps, what's next
- `docs/REVIEW-FINDINGS.md` — adversarial review results
- `TOUR.md` — guided codebase walkthrough
