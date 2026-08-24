---
title: Installation
description: Run VibeKit from the current source checkout.
draft: false
---


The public install channel is part of VibeKit’s release work. Until it is
available, run the current CLI from a source checkout with Bun.

## Requirements

- Bun
- Docker Compose v2 for LocalNet
- A Secret Service keychain on Linux when you use the keystore

Clone the repository and install its workspace dependencies:

```bash
bun install
```

Run the CLI from the `apps/cli` workspace:

```bash
bun --cwd apps/cli run dev -- --help
```

For example, scaffold a project with:

```bash
bun --cwd apps/cli run dev -- new my-algorand-app --template contracts
```

## Run the Explorer from source

The Explorer is a separate terminal application. Start it from the repository
root after building its package dependencies:

```bash
bun run --filter @initlabs/vibekit-tui dev
```

Once a released `vibekit` binary is installed, the equivalent commands are
`vibekit new`, `vibekit init`, and `vibekit explore`.
