# AGENTS.md

Guidance for AI agents working on this repo.

## What this is

VibeKit v2: a stateless MCP server for Algorand built on published tool packages
(`@initlabs/*`), plus the `vibekit` CLI. [docs/DESIGN.md](./docs/DESIGN.md) is the canonical
design doc — read it before structural changes. Operational state: [docs/HANDOVER.md](./docs/HANDOVER.md);
adversarial review: [docs/REVIEW-BRIEF.md](./docs/REVIEW-BRIEF.md); map: docs/architecture.html. The hosted API + explorer live in a separate
repo (`initlabs/vibekit-agent`) and consume these packages from npm.

## Hard rules

- **One tool contract.** Every tool is a `ToolDefinition` from `@initlabs/vibekit-core`, created via
  `defineTool()`. No bespoke handler signatures, ever (v1 died of this).
- **Stateless.** No module-level mutable state in server or tool code. Everything a handler
  needs arrives via `ToolContext`, constructed per request.
- **JSON-safe results via `jsonSafe()`** in the adapter — handlers may return bigints/bytes freely.
- **Errors are thrown** (`ToolError` with a code), never returned as `{ error }` shapes.
- **Tests land with code.** Every tool domain ships with handler tests (`bun test`).
- One tsconfig convention: every package extends `tsconfig.base.json` (NodeNext, `.js`
  extensions in relative imports). Published packages build to `dist/` with exports maps.
- `algosdk`, `zod`, and `@initlabs/vibekit-core` are peer dependencies of tool/plugin packages.
- Run `bun run typecheck` and `bun run test` before commits. Conventional commits. No co-author lines.
- Ask before adding dependencies. Pin `algosdk@beta` / keystore canary exactly.
