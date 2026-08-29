# Project lifecycle

Use this guide for project creation, initialization, build scripts, LocalNet,
and setup troubleshooting.

## Choose a starter

`vibekit new` offers three additive TypeScript starters:

| Template      | Contents                                                                    |
| ------------- | --------------------------------------------------------------------------- |
| `contracts`   | PuyaTs contracts, generated TypeScript clients, unit and LocalNet E2E tests |
| `fullstack`   | Contracts plus a React frontend and wallet integration                      |
| `kitchensink` | Contracts, frontend, event subscriber, and additional examples              |

Create a project with an explicit template:

```bash
vibekit new my-app --template contracts
cd my-app
npm install
```

For a fully headless run, also pass `--yes` and an explicit `--agents` list as
shown by `vibekit new --help`.

Without `--template`, let the user choose interactively. `vibekit new` fetches
the selected repository and then runs the same agent-setup flow as
`vibekit init`; skills, `AGENTS.md`, and MCP configuration are installed from
the CLI rather than baked into the starter repositories.

## Use the direct TypeScript toolchain

The starters do not require the AlgoKit CLI. Their npm scripts invoke the
underlying packages directly:

- `@algorandfoundation/puya-ts` compiles `*.algo.ts` contracts to TEAL and
  ARC-56 artifacts.
- `@algorandfoundation/algokit-client-generator` generates typed TypeScript
  clients from ARC-56 application specs.
- `algosdk` provides protocol-level clients, transactions, and signing types.
- `@algorandfoundation/algokit-utils` provides higher-level client,
  composition, testing, and application abstractions.

Treat `package.json` as the command source of truth. In the current starters,
the normal loop begins with:

```bash
vibekit localnet start
npm run build
npm test
```

Full-stack projects also provide `npm run dev`; the kitchen-sink starter adds
`npm run dev:subscriber`. Inspect scripts before using optional commands.

## Configure an existing project

```bash
vibekit init
```

This installs selected skills and agent/MCP configuration into the existing
directory. It merges supported configuration rather than replacing unrelated
MCP servers. Read the preview or prompt before allowing overwrites of existing
agent instruction files.

For user-scoped MCP and skills that apply to every project on the machine:

```bash
vibekit init --global
```

Do not pass a project directory with `--global`. `vibekit new` always scaffolds
a project; use `vibekit init --global` when you want the global scope.

## Manage LocalNet

VibeKit owns the Docker-based local network lifecycle:

```bash
vibekit localnet start
vibekit localnet status
vibekit localnet fund ADDRESS --amount 10
vibekit localnet logs --tail 50
vibekit localnet reset
vibekit localnet stop
```

The default endpoints are Algod on `http://localhost:4001`, Indexer on
`http://localhost:8980`, and KMD on `http://localhost:4002`. Another LocalNet
using these ports cannot run concurrently.

`vibekit localnet reset` recreates the network. Treat it as destructive to
local chain state and confirm that resetting is intended. Add `--update` only
when the user also wants refreshed container images.

## Diagnose setup

```bash
vibekit doctor
vibekit doctor --fix
```

Run the read-only diagnosis first. Use `--fix` when the user asked for repair
or after explaining which supported configuration VibeKit will change.

Use `vibekit --version` to report the installed version. VibeKit currently has
no documented self-update command, so do not invent one.
