# Codebase tour

A guided walk, one piece at a time. Each piece gets a "key idea" line once
covered. Current position: **→**

| # | Piece | Where | Status |
|---|-------|-------|--------|
| 1 | The tool contract | `packages/core/src/contract.ts` | → |
| 2 | Deployments + executeToolCall | `packages/core/src/deployment.ts` | |
| 3 | The jsonSafe codec | `packages/core/src/codec.ts` | |
| 4 | The compose engine | `packages/core/src/compose/` | |
| 5 | A tool package, end to end | `packages/tools-assets/` | |
| 6 | Custody: the keystore signer | `packages/signer-keystore/` | |
| 7 | Hosts: MCP, agent, CLI | `packages/mcp/`, `packages/agent/`, `apps/cli/src/commands/{mcp,tool}.ts` | |
| 8 | CLI, init, and skills | `apps/cli/` | |
| 9 | Plugins | `packages/plugin-nfd/` | |

## Key ideas

1. _pending_
2. _pending_
3. _pending_
4. _pending_
5. _pending_
6. _pending_
7. _pending_
8. _pending_
9. _pending_

## Vocabulary

- **Tool**: one capability, always a `ToolDefinition`.
- **Deployment**: a configured set of tools (networks, mode, signer). The unit
  where policy is decided.
- **Host**: a process exposing a deployment over some wire (stdio MCP, HTTP,
  agent loop, CLI).
- **Execute / compose**: sign-and-send vs. return unsigned transactions for
  external signing.
