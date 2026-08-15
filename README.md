# VibeKit

AI-native developer tooling for Algorand: a stateless MCP server (2026-07-28 spec) built on
published, reusable tool packages, plus the `vibekit` CLI.

> **Status: v2 rewrite in progress.** See [docs/DESIGN.md](./docs/DESIGN.md) for the architecture
> and migration plan. The v1 repo remains the running product until cutover.

## Layout

```
apps/
  mcp/          Reference MCP deployment (stdio + streamable HTTP) — copy this to self-host
packages/
  core/         @initlabs/vibekit-core — the tool contract (ToolDefinition, ToolContext), network clients, codecs
  mcp/          @initlabs/vibekit-mcp — createVibekitMcp(): the MCP server as a library
```

Tool packages (`tools-*`), signers, plugins, and the CLI land per the migration plan.

## Development

```bash
bun install
bun run build        # turbo: build everything
bun run typecheck
bun run test
```

## License

Apache-2.0 © Init Labs LLC
