# @initlabs/vibekit-mcp

## 1.0.0-alpha.0

### Major Changes

- First public prerelease.

  VibeKit exposes Algorand capabilities through one shared tool contract across
  MCP, the CLI, and an agent loop. Every tool is a `ToolDefinition` with Zod
  parameters, an enforced output schema, and a handler; every host routes calls
  through `executeToolCall`, so the same tool behaves identically whether an
  agent, a shell, or the Explorer invoked it.

  - **Tools** for accounts, assets, contracts, network, and transactions, served
    from one package as per-domain exports.
  - **Writes build transaction groups** through a single compose engine. In
    execute mode the host signs and sends; in compose mode it returns the group
    unsigned. There is no side path around it.
  - **Custody stays outside the tool process.** The keystore signer talks
    JSON-RPC to a local daemon over a socket — no key material crosses the
    boundary. TestNet funding runs through an authenticated dispenser session.
  - **MCP adapters** for stdio and stateless Streamable HTTP, so any MCP client
    can drive the same deployment.
  - **Plugins** for NFD, Pera, Vestige, and Alpha Arcade, each declaring
    `algosdk`, Zod, and `@initlabs/vibekit-core` as peers.
  - **The Explorer** (`vibekit explore`): a chat-first terminal transcript with a
    results feed — deterministic lookup, live global state, one card per
    contract, ABI method calls checked by type (reads simulate inline, writes go
    through an approval modal with decoded arguments and keystore signing), and
    spec deployment from a card.
  - **Project setup**: `vibekit new` scaffolds from a starter template and
    `vibekit init` installs skills and MCP configuration for Claude, Codex, and
    Grok. LocalNet management, a `doctor` command, and shell access to any tool
    round it out.

  Prerelease caveats: the packages carry no API stability promise until 1.0, the
  Explorer presentation protocol is not frozen, and macOS and Windows are not yet
  confirmed.

### Patch Changes

- Updated dependencies
  - @initlabs/vibekit-core@1.0.0-alpha.0
