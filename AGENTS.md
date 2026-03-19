# AGENTS.md

Guidance for AI agents working on this repo. User docs live at [getvibekit.ai](https://getvibekit.ai).

## Code Style

Write code that is easy to read and maintain. Optimize for how easy the code is to understand and follow by skimmming. Avoid cleverness. Use early returns.

## What This Is

VibeKit is a CLI + explorer for Algorand. The CLI bootstraps AI coding environments (agent skills, MCP servers). The explorer is an agentic blockchain explorer powered by LLM tool calling.

## Architecture

```
vibekit/
├── apps/
│   ├── cli/                    # CLI binary (Bun, compiles to standalone)
│   ├── mcp-server/             # MCP server, started via `vibekit mcp`
│   ├── explorer/               # Chat UI for the explorer (Next.js, deployed to Vercel)
│   ├── api/                    # Query API — LLM orchestration + tools (Hono/Bun, Docker)
│   └── website/                # Docs site (Astro/Starlight, deployed to Vercel)
├── packages/
│   ├── core/                   # Shared types (ToolDefinition, ToolHandlerContext), validators, utilities
│   ├── tools/                  # All domain tools (network, accounts, assets, contracts, transactions, nfd, ecosystem)
│   ├── provider-*/             # Account providers (vault, keyring, walletconnect)
│   ├── dispenser-*/            # Dispenser providers (kmd, testnet)
│   ├── keyring/                # OS keyring abstraction
│   ├── config/                 # Shared config
│   └── db/                     # Local data store
```

### Package conventions

- Domain packages (`core`, `tools`) export TypeScript source (`main: src/index.ts`) — they're consumed by the explorer via `transpilePackages` and by the MCP server, and use extensionless imports.
- All other packages export compiled output (`main: dist/index.js`) and use `.js` extensions in imports — they're only consumed by the CLI/MCP server via `tsx`/bun.

### Tool architecture

Domain packages define tools as `ToolDefinition` objects (from `@vibekit/core`). Each definition has a `name`, `description`, Zod `parameters` schema, and a `handler` that receives a `ToolHandlerContext` (containing `algorand`, `args`, `resolveSender`, `resolveAppSpec`). This keeps tools framework-agnostic.

Consumers adapt these definitions to their framework:

- **MCP server** — `apps/mcp-server/src/tools/indexer/index.ts` wraps all domain tools as MCP tool registrations, injecting `resolveSender` and `resolveAppSpec` implementations.
- **Query service** — `apps/api/src/lib/tools.ts` wraps domain tools as AI SDK tools (`ai` package), adding asset enrichment and formatting. Serves them via Hono HTTP endpoints.

### Query service

- Standalone Hono/Bun API that owns all LLM orchestration, tool calling, and data enrichment.
- Two endpoints: `POST /chat` (AI SDK UI message stream protocol) and `POST /query` (NDJSON/JSON for non-JS consumers).
- LLM provider config in `apps/api/src/lib/llm.ts` — Together AI in prod, OpenAI-compatible (Ollama) for local dev.
- Uses `@ai-sdk/openai` with `.chat()` (Chat Completions API) for OpenAI-compatible providers. Do not use `provider()` directly — it defaults to the Responses API which Ollama doesn't support.
- Supports per-request customization: `systemPrompt` (append-only) and `tools` (filter by name).
- Auth via Bearer token (`API_KEYS` env var). Rate limiting per API key label.
- Env vars: see `apps/api/.env.example`.

### Explorer

- Next.js chat UI that consumes the query service via `POST /chat`.
- Uses `@ai-sdk/react` `useChat()` with `DefaultChatTransport` pointed at the query service URL.
- No direct LLM or tool dependencies — all orchestration is in the query service.
- Env vars: `NEXT_PUBLIC_QUERY_SERVICE_URL`, `NEXT_PUBLIC_QUERY_SERVICE_KEY`. See `apps/explorer/.env.example`.

## Dev Commands

```bash
bun install              # Install deps
bun run build            # Build everything (uses Turborepo)
bun run typecheck        # Type check (run before commits)
bun run dev:cli          # Run CLI from source
bun run dev:mcp          # Run MCP server from source
bun run dev:explorer     # Run explorer + query service locally
bun run dev:api          # Run query service only
bun run dev:website      # Run docs site locally
```

## Releasing

Update version in `apps/cli/package.json`, then:

```bash
git tag cli-v0.1.0
git push origin cli-v0.1.0
```

GitHub Actions builds binaries for all supported platforms and creates the release.

## Adding Things

**CLI command:** Create in `apps/cli/src/commands/`, export from `commands/index.ts`, add to router in `index.ts`

**MCP tool:** Define a `ToolDefinition` in the appropriate domain subdirectory (`packages/tools/src/<domain>/tools.ts`), export it from the subdirectory's `index.ts` and from `packages/tools/src/index.ts`. The MCP adapter (`apps/mcp-server/src/tools/indexer/index.ts`) picks up all exported domain tools automatically.

**Package:** Create `packages/<name>/` with standard setup, name it `@vibekit/<name>`, add as `workspace:*` dependency

## Rules

- Run `bun run typecheck` before commits
- Use conventional commits (`feat:`, `fix:`, `docs:`, `refactor:`, `chore:`)
- Don't add yourself as co-author
- Don't commit secrets or hardcode paths
- Ask before adding dependencies
- Add JSDocs for shared utilities and APIs, and comments for edge cases and assumptions. Otherwise, let the code speak for itself.
