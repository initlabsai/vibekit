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
sign. The hosted stack is planned to keep the same custody boundary.

## What is here

- An MCP server library plus stdio and Streamable HTTP reference deployments
- The `vibekit` CLI for agent setup, project scaffolding, LocalNet, keystore
  access, diagnostics, and direct tool calls
- Tool packages for networks, accounts, assets, transactions, and contracts
- NFD and Alpha Arcade plugins
- A local keystore signer and authenticated TestNet funding flow
- A provider-agnostic agent loop, project-installable skills, and acceptance
  prompts
- A public Astro/Starlight landing page and Markdown documentation site

## Explorer

The Explorer is a chat-first, agent-first Algorand surface for terminal and
web. Each request becomes a chronological feed group containing its narration
and trusted result cards; direct identifiers route deterministically before any
model call, and writes pause at an explicit approval modal.

The fixture-backed TUI uses React with OpenTUI; the web renderer uses React
with Next.js. They share the provisional `@initlabs/vibekit-explorer`
protocol, result store, write-flow machine, fixtures, and semantic view models
while keeping terminal and browser primitives native to each platform. The
private apps are independently built deployment units and consume the public
package surface. The hosted API and SDK remain planned.

## Status

The core engine, tools, plugins, signer, MCP adapters, agent loop, CLI, the
provisional explorer package, and the fixture-backed TUI/web renderers are
implemented and tested. The next work is the hosted API/SDK and the 1.0
publish gate. The `vibekit explore` CLI entry point is implemented; browser
wallet custody is still pending. The current skill bundle covers VibeKit operation and
extension plus TypeScript Algorand contracts, clients, testing, frontend
wallets, standards, migrations, structured security audits, and maintenance of
the skill set itself.

## Development

```bash
bun install
bun run build
bun run typecheck
bun run test
```

To run only the Explorer apps during development:

```bash
bun --cwd apps/tui run dev
bun --cwd apps/web run dev
bun run website
```

## Documentation

- [Design](./docs/DESIGN.md) — architecture, current state, gaps, and roadmap
- [Constitution](./docs/CONSTITUTION.md) — project principles and contribution
  standards
- [Website source](./apps/website) — landing page and Markdown documentation
