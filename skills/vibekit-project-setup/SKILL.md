---
name: vibekit-project-setup
description: Scaffold, configure, and run Algorand projects with the vibekit CLI — vibekit new (templates), init (agent setup), localnet lifecycle and funding, doctor. Load when creating a project, setting up the dev environment, or managing the local network.
---

# VibeKit Project Setup

The `vibekit` CLI owns project scaffolding, agent configuration, and the local
network. It replaces the AlgoKit CLI for those jobs (compilation and typed
client generation stay with AlgoKit inside template projects).

## New project

```bash
vibekit new my-app --template contracts   # or: fullstack | kitchensink
```

Fetches a starter template (no git/npm needed) and then runs agent setup into
the new directory — skills, `AGENTS.md`, and MCP config come out ready to use.
Templates are additive tiers:

- **contracts** — puya-ts smart contracts, typed clients, vitest tests
- **fullstack** — contracts + React frontend with wallet integration
- **kitchensink** — everything, with extra examples

Then:

```bash
cd my-app
npm install
vibekit localnet start
npm run build          # compiles contracts, generates typed clients
npm test
```

## Existing project

```bash
vibekit init           # agent selection, skills, MCP config — merges into
                       # existing configs, never clobbers other MCP servers
```

## LocalNet (Docker)

```bash
vibekit localnet start        # first run writes config to ~/.config/vibekit/localnet
vibekit localnet status       # container + node health (algod round, indexer)
vibekit localnet fund ADDR --amount 10   # dispenser funding via kmd
vibekit localnet logs --tail 50
vibekit localnet reset        # recreate from scratch (--update pulls new images)
vibekit localnet stop
```

Endpoints when running: algod `http://localhost:4001`, indexer
`http://localhost:8980`, kmd `http://localhost:4002` (token: 64 × `a`).
Only one localnet can bind these ports — if AlgoKit's localnet is running,
stop it first (they are interchangeable; same ports and genesis layout).

## Accounts & signing setup

```bash
npm i -g @algorandfoundation/keystore-node   # the keystore CLI
keystore generate                            # create an account (OS keychain)
keystore serve                               # signing daemon — enables execute mode
```

## When something is broken

```bash
vibekit doctor         # checks binary, MCP config, Docker, keystore
vibekit doctor --fix   # repairs broken/legacy MCP entries and stale binaries
```

## Boundary with AlgoKit

Inside template projects, `algokit project run build` / puya compilation /
typed-client generation still belong to AlgoKit tooling (lockfile-pinned in the
template). Everything environmental — scaffolding, localnet, funding, agent
config, accounts — is vibekit's.
