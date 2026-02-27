# AGENTS.md

Guidance for AI agents working on this repo. User docs live at [getvibekit.ai](https://getvibekit.ai).

## What This Is

VibeKit is a CLI that bootstraps AI coding environments for Algorand. It installs agent skills and configures MCP servers. The MCP server is bundled into the CLI binary (`vibekit mcp`).

## Architecture

```
vibekit/
├── apps/
│   ├── cli/                    # Main CLI binary (Bun, compiles to standalone)
│   │   ├── src/index.ts        # Entry point, command router
│   │   ├── src/commands/       # Command handlers (init, status, vault, etc.)
│   │   └── src/lib/            # Shared utilities
│   ├── mcp-server/             # MCP server (bundled into CLI)
│   │   └── src/tools/          # Tool implementations by category
│   └── website/                # Docs site (Astro/Starlight, deployed to Vercel)
├── packages/                   # Shared libraries
│   ├── provider-*/             # Account providers (vault, keyring)
│   ├── dispenser-*/            # Dispenser providers (kmd, testnet)
│   └── keyring/                # OS keyring abstraction
```

## Dev Commands

```bash
bun install              # Install deps
bun run build            # Build everything (uses Turborepo)
bun run typecheck        # Type check (run before commits)
bun run dev:cli          # Run CLI from source
bun run dev:mcp          # Run MCP server from source
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

**MCP tool:** Create in `apps/mcp-server/src/tools/<category>/`, export from category's `index.ts`

**Package:** Create `packages/<name>/` with standard setup, name it `@vibekit/<name>`, add as `workspace:*` dependency

## Rules

- Run `bun run typecheck` before commits
- Use conventional commits (`feat:`, `fix:`, `docs:`, `refactor:`, `chore:`)
- Don't add yourself as co-author
- Don't commit secrets or hardcode paths
- Ask before adding dependencies
- Add JSDocs for shared utilities and APIs, and comments for edge cases and assumptions. Otherwise, let the code speak for itself.
