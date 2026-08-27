---
title: Installation
description: Run VibeKit from the current source checkout.
draft: false
---


The public install channel is part of VibeKit’s release work. Until it is
available, run the current CLI from a source checkout with Bun.

## Requirements

- Bun 1.4 or newer
- Node.js and npm (the keystore daemon runs under Node; `vibekit keystore`
  installs the pinned `@algorandfoundation/keystore-node` for you)
- Docker Compose v2 for LocalNet
- A Secret Service keychain on Linux when you use the keystore

Clone the repository and install its workspace dependencies:

```bash
bun install
```

Run the CLI from the repository root (this builds its workspace dependencies
first):

```bash
bun run cli -- --help
```

For example, scaffold a project with:

```bash
bun run cli -- new my-algorand-app --template contracts
```

## Run the Explorer from source

The Explorer is a separate terminal application. Start it from the repository
root:

```bash
bun run tui
```

`bun run cli -- explore` also works; set `VIBEKIT_EXPLORE` to point it at a
specific TUI entry.

Once a released `vibekit` binary is installed, the equivalent commands are
`vibekit new`, `vibekit init`, and `vibekit explore`.
