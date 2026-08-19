# VibeKit

VibeKit gives AI agents both the capabilities and the guidance to build on
Algorand. Agents can query the chain, inspect accounts and transactions,
manage assets, deploy and call contracts, and compose or execute transaction
groups.

The CLI also installs canonical skills into a project. This is the delivery
mechanism for maintained guidance on writing smart contracts, generating
clients, building frontend interfaces, and following Algorand conventions
alongside the raw chain tools.

The same tool surface is available through an MCP server, the `vibekit` CLI,
an agent runtime, and reusable TypeScript packages. Local writes are signed
through a keystore daemon, so key material never enters the model context.
Signerless deployments return unsigned groups for a wallet to review and
sign. The planned hosted stack keeps the same custody boundary.

## What is here

- An MCP server library plus stdio and Streamable HTTP reference deployments
- The `vibekit` CLI for agent setup, project scaffolding, LocalNet, keystore
  access, diagnostics, and direct tool calls
- Tool packages for networks, accounts, assets, transactions, and contracts
- NFD and Alpha Arcade plugins
- A local keystore signer and authenticated TestNet funding flow
- A provider-agnostic agent loop, project-installable skills, and acceptance
  prompts

## Explorer

The next product surface is a Lora-like, agent-first Algorand Explorer for
terminal and web. It combines persistent network and wallet state, navigation,
tabs, direct identifier lookup, trusted transaction review, and a docked
natural-language composer.

The TUI uses React with OpenTUI; the web app uses React with Next.js. They
share experience state, hooks, view models, and selected semantic component
trees while keeping terminal and browser primitives native to each platform.
The Explorer, hosted API, and SDK are developed in this monorepo as separate
apps and packages. Each app remains independently built and deployed while
consuming the same public `@initlabs/*` package surface.

## Status

The core engine, tools, plugins, signer, MCP adapters, agent loop, and CLI are
implemented and tested. The first package and binary release is being prepared;
the shared TUI/web Explorer is the next implementation phase. The current
skill bundle covers VibeKit use and project setup; contract and frontend domain
skills are being refactored against the current stack before they return.

## Development

```bash
bun install
bun run build
bun run typecheck
bun run test
```

## Documentation

- [Design](./docs/DESIGN.md) — architecture, current state, gaps, and roadmap
- [Constitution](./docs/CONSTITUTION.md) — project principles and contribution
  standards
