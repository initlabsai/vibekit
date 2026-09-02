# @initlabs/vibekit

## 1.0.0-alpha.3

### Minor Changes

- 1d70e80: `createActionRoutes` / `createRemoteActionHost` in `@initlabs/vibekit/actions`: an ActionHost over HTTP — the server verifies every signed byte against the approved draft before recording or broadcasting; the browser injects the wallet. `createReadHost` / `recordForToolCall` in `/views`: the lookup surface over any way of calling a tool, and a tool's output as its view's record. The REST query response now carries the tool's `view` id. The web agent's bespoke explorer RPC is gone: reads are the query handler, actions are the routes.
- 2b93d31: `@initlabs/vibekit/actions`: the record envelope, stage events, action reducer, host controller, and wallet signing move from the explorer into the published package, browser-safe. The explorer keeps its view models (the action view model is now `views/action.ts`) and re-exports the moved names, so app imports keep working. `EXPLORER_PROTOCOL_VERSION` → `RECORD_PROTOCOL_VERSION`.
- adac150: `createAgentHandler` in `@initlabs/vibekit/agent`: the agent as a web-standard HTTP handler — one POST per turn, NDJSON events back, composed groups leaving as `draft` records. The model, tools, prompt, per-turn caps, and billing are options; nothing reads the environment. Draft decoding (`decodeUnsignedGroup`, `draftRecordFromComposeWire`, the algod transaction formatter) and `activeSenderLine` move into the package; the explorer re-exports them.
- 9cc01db: `@initlabs/vibekit/tools` now exports only what consumers use: the tool arrays, the ARC-56 toolkit (`normalizeAppSpec`, `toolsFromArc56`, `toolsWithMethods`, `toolArgsFor`, `enrichTransactionsWithAbi`, `labelSelectors`, `programHash`, `estimateProgramTokens`, `DEPLOYER_NOTE_PREFIX`), `txnSpecSchema`, the transaction wire schemas, and `viewDataSchemas`. The per-domain lookup functions and app-spec internals are no longer re-exported.
- 57a844d: The names, settled. `actions`: `draftDataSchema`/`DraftData`, `simulationDataSchema`, `stageEventSchema`/`createStageEvent`, `actionIntentSchema`, `actionResultSchema`, `createRecord`, `nextActionEvents`, `createActionHost(deployment)`, `signDraftWith`. `views` exports views only (records and the machine come from `actions`); fixtures are `views/sample`; `ReadHost`, `classifyInput`, `routeInput`, `InputRoute`, `formatTime`; `createDeploymentReadHost`, the block tail. `preset`: `createHost(network)` (the stock combined host) and the Explorer agent (`createExplorerAgent`, `explorerTools`, `explorerSystemPrompt`, `explorerPlugins`, `explainApplicationTool`). `live` is gone. `mcp`: `createMcpServer`, `createMcpServerFactory`, `createMcpHttpHandler`, `serveMcpStdio`. `rest`: `createRestHandler`, `POST …/tools/<name>`. The root exports the contract only; the compose engine is `@initlabs/vibekit/compose`; provider plumbing is `agent/providers`, the config file is `agent/config`.
- 7cb1dfb: The third-party SDKs behind `./agent`, `./mcp`, `./signer-keystore`, and the plugins are optional peer dependencies now, not dependencies. `algosdk` and `zod` stay the only required peers; a consumer that imports only the contract and the tools installs nothing else. Each subpath's peers are listed in the README.
- 29f2f7f: `@initlabs/vibekit/pay`: `createPaywall` — an x402 payment in USDC becomes credit on a store you supply, and `charge` takes a turn (free by IP, then paid by bearer token) or answers 402; `createX402Gate` is the web-standard gate underneath, mounting in Next, Bun, Hono, or Workers unchanged. `@initlabs/vibekit/rest`: `createQueryHandler` — `POST …/query/<tool>` over the tool contract, plus a JSON Schema catalogue. Both are optional peers on `@x402/core` and `@x402/avm`.
- c53d5ba: Tools are queries or actions. `assetTools` → `assetQueries`, `assetWriteTools` → `assetActions` (same for accounts, transactions, contracts, network); the preset adds `defaultQueries` and `defaultActions` beside `defaultTools`. Core adds `isAction`, `defineQuery`, `defineAction`, and `output` is now required on every tool. The explorer's write flow is the action machine: `WriteFlow*` → `Action*`, `startWriteFlow` → `startAction`, `completeApprovedWriteFlow` → `submitAction`, `src/flows` → `src/actions`.
- 1de69fb: Three tool names now follow the grammar the rest use — `lookup_<entity>` reads one by id via the indexer, `get_<entity>_<facet>` reads a facet from algod or a file, `search_<entities>` filters a list, `list_*` enumerates: `app_get_info` is `get_application_info`, `app_list_methods` is `list_app_spec_methods`, and `search_asset_balances` is `search_asset_holders`. The paired indexer/algod tools describe when to use which.
- 34b9809: `executeToolCall` validates arguments against the tool's parameter schema before the handler runs (`INVALID_ARGS`), so every host gets defaults and drops extras the same way. Local file reads are now a capability a deployment grants with `readFile` (`readLocalFile` from `./preset` on local hosts); without it, `appSpecPath` answers `APP_SPEC_PATH_UNAVAILABLE` instead of reading the host's filesystem. Write tools fetch suggested params once per group.
- 6452c1d: `@initlabs/vibekit/views` (browser-safe: records by view id, the view models cards render, the transactions graph, formatting, input classification, recorded sample data) and `@initlabs/vibekit/live` (a deployment as a live host: reads as records, an ActionHost, the block tail, the Explorer agent's tool set and prompt). These were the private `@initlabs/vibekit-explorer` package, which is gone: the apps now build on the published package alone.

### Patch Changes

- a409e52: Type-check the test suites, fix the `searchAssetBalances` return type (it always returned `decimals`), rename the MCP adapter's internal `resolveDeployment` to `resolveMcpDeployment`, and describe the code as shipped in comments.
- 5cb65f3: `asset_create` now validates `freeze` and `clawback` addresses the way it validates `manager` and `reserve` (a bad address is `INVALID_ADDRESS`, not a deep algosdk error). Interface/schema drift guards cover the account, asset, and program wire shapes; `app_deploy`/`app_update` resolve ABI methods from the spec they already normalized.
- 306669d: `apps/reference`: the reference agent — a Bun server mounting `createAgentHandler`, `createActionRoutes`, and `createRestHandler`, and a Vite/React page over the `vibekit add` components. About 200 lines of app; the tutorial's endpoint.

## 1.0.0-alpha.2

### Patch Changes

- Pin the formatter to the style the codebase was already written in and format
  the tree to it. No behavior change.

## 1.0.0-alpha.1

### Major Changes

- Collapse the ten npm packages into one, `@initlabs/vibekit`, with subpath
  exports. `@initlabs/vibekit-core` is now the root import; the rest move to
  `./tools`, `./tools/views`, `./agent`, `./agent/config`, `./mcp`,
  `./mcp/stdio`, `./mcp/http`, `./signer-keystore`, `./preset`, and
  `./plugins/<name>`. The old package names are retired.

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
