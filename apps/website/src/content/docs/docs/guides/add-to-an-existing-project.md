---
title: Add VibeKit to an existing project
description: Configure skills and MCP tools without replacing the project you have.
draft: false
---


Run VibeKit from the root of the existing project:

```bash
vibekit init
```

The interactive setup asks which supported agent harnesses, skills, and MCP
servers to configure. Read the preview before confirming changes to an existing
agent-instructions file.

## What it adds

VibeKit installs the selected skills in each harness’s discovery location,
writes or updates its MCP configuration, and generates project instructions
that route an agent to the right skill for the task. It preserves unrelated MCP
servers in supported JSON configurations.

The VibeKit MCP entry invokes your local `vibekit mcp` command over stdio. The
agent receives the stock read and write tools for accounts, assets, contracts,
transactions, and network data, plus the default plugins (NFD, Alpha Arcade,
Vestige, Pera). It defaults to LocalNet while serving localnet, testnet, and
mainnet, and signs through the local keystore daemon (`SIGNING=execute`),
falling back to compose mode when the daemon is not running.

## Keep your project’s commands

VibeKit does not replace a project’s build, test, or deployment scripts. Treat
its `package.json` as the command source of truth. Use VibeKit for agent setup,
LocalNet, keystore-backed signing, and on-chain operations.

To run without prompts in automation, pass explicit selections:

```bash
vibekit init --yes --agents claude --skills all
```

Use `vibekit --help` for the complete headless flags: `--agents <csv>` (required
with `--yes`), `--skills all|none|<csv>`, `--mcps none|<csv>`, and `--overwrite`. Existing agent files
remain in place during headless setup unless you explicitly pass `--overwrite`.

## Check the setup

```bash
vibekit doctor
```

Start with the read-only diagnosis. Use `vibekit doctor --fix` only when you
want it to repair the supported configuration it reports.
