# @initlabs/vibekit-cli

## 1.0.0-alpha.3

### Minor Changes

- 57a844d: The names, settled. `actions`: `draftDataSchema`/`DraftData`, `simulationDataSchema`, `stageEventSchema`/`createStageEvent`, `actionIntentSchema`, `actionResultSchema`, `createRecord`, `nextActionEvents`, `createActionHost(deployment)`, `signDraftWith`. `views` exports views only (records and the machine come from `actions`); fixtures are `views/sample`; `ReadHost`, `classifyInput`, `routeInput`, `InputRoute`, `formatTime`; `createDeploymentReadHost`, the block tail. `preset`: `createHost(network)` (the stock combined host) and the Explorer agent (`createExplorerAgent`, `explorerTools`, `explorerSystemPrompt`, `explorerPlugins`, `explainApplicationTool`). `live` is gone. `mcp`: `createMcpServer`, `createMcpServerFactory`, `createMcpHttpHandler`, `serveMcpStdio`. `rest`: `createRestHandler`, `POST …/tools/<name>`. The root exports the contract only; the compose engine is `@initlabs/vibekit/compose`; provider plumbing is `agent/providers`, the config file is `agent/config`.
- 476e202: `vibekit add <component…>`: copies a React component's source into your project, ShadCN-style — `companion`, `action` (the headless useAction hook), `approval`, `tool-result`, `transaction`, `asset`, `account`. Each takes a tool's output type as props; the .css files are hooks to restyle. `--list` browses, `--dir` targets, `--force` overwrites. The source of truth is `packages/vibekit/components`, bundled at build time.

### Patch Changes

- `vibekit init` merges existing files instead of clobbering them. Pointer files
  (CLAUDE.md, .cursorrules, copilot instructions) gain the AGENTS.md paragraph by
  guarded append; a project's own AGENTS.md is kept, with VibeKit's written beside
  it as AGENTS.vibekit.md and chained by one line. TOML configs (codex, grok) now
  parse-and-merge like JSON, so your settings and MCP servers survive. The
  install-path prompt is a real path picker with tab completion.
- Updated dependencies [1d70e80]
- Updated dependencies [2b93d31]
- Updated dependencies [adac150]
- Updated dependencies [a409e52]
- Updated dependencies [9cc01db]
- Updated dependencies [5cb65f3]
- Updated dependencies [57a844d]
- Updated dependencies [7cb1dfb]
- Updated dependencies [29f2f7f]
- Updated dependencies [c53d5ba]
- Updated dependencies [306669d]
- Updated dependencies [1de69fb]
- Updated dependencies [34b9809]
- Updated dependencies [6452c1d]
  - @initlabs/vibekit@1.0.0-alpha.3

## 1.0.0-alpha.2

### Patch Changes

- Pin the formatter to the style the codebase was already written in and format
  the tree to it. No behavior change.
- Updated dependencies
  - @initlabs/vibekit@1.0.0-alpha.2

## 1.0.0-alpha.1

### Major Changes

- Collapse the ten npm packages into one, `@initlabs/vibekit`, with subpath
  exports. `@initlabs/vibekit-core` is now the root import; the rest move to
  `./tools`, `./tools/views`, `./agent`, `./agent/config`, `./mcp`,
  `./mcp/stdio`, `./mcp/http`, `./signer-keystore`, `./preset`, and
  `./plugins/<name>`. The old package names are retired.

### Patch Changes

- Updated dependencies
  - @initlabs/vibekit@1.0.0-alpha.1

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
    `algosdk`, Zod, and `@initlabs/vibekit` as peers.
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
  - @initlabs/vibekit@1.0.0-alpha.0
  - @initlabs/vibekit/tools@1.0.0-alpha.0
  - @initlabs/vibekit/mcp@1.0.0-alpha.0
  - @initlabs/vibekit/agent@1.0.0-alpha.0
  - @initlabs/vibekit/signer-keystore@1.0.0-alpha.0
  - @initlabs/vibekit/preset@1.0.0-alpha.0
  - @initlabs/vibekit/plugins/nfd@1.0.0-alpha.0
  - @initlabs/vibekit/plugins/pera@1.0.0-alpha.0
  - @initlabs/vibekit/plugins/vestige@1.0.0-alpha.0
  - @initlabs/vibekit/plugins/alpha-arcade@1.0.0-alpha.0
