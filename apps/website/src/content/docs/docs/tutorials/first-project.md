---
title: Your first project
description: Scaffold an Algorand project and set it up for an AI coding agent.
draft: false
---

This tutorial creates a contracts project, configures an agent, and starts a
local Algorand network. You need Docker for LocalNet and a working `vibekit`
command. See [installation](../reference/installation/) when working from a
source checkout.

## Create the project

Choose the contracts starter, which includes PuyaTs contracts, generated
TypeScript clients, and tests.

```bash
vibekit new my-algorand-app --template contracts
cd my-algorand-app
npm install
```

`vibekit new` finishes by offering to configure the agents in the project. Let
it do that: the selected skills, agent instructions, and VibeKit MCP entry are
installed by the CLI rather than baked into the starter.

## Start LocalNet

```bash
vibekit localnet start
npm run build
npm test
```

LocalNet runs Algod, Indexer, and KMD through Docker. It owns ports 4001, 8980,
and 4002, so stop another local Algorand network first if it already uses those
ports.

## Open your agent

Open the project with the agent harness you chose during setup. It now has the
VibeKit MCP server and the relevant Algorand skills available. Ask it to read
the project instructions, inspect the contract, or make a small change and run
the test suite.

For chain actions, the agent uses typed tools. It discovers the available
networks and passes a sender and network explicitly for writes. It should never
ask you for a mnemonic or paste one into a prompt.

## What next?

- Use [the Explorer](../explore-with-vibekit/) when you want a focused terminal
  interface for chain data and review.
- Use [the existing-project guide](../guides/add-to-an-existing-project/)
  to bring the same setup to a project you already have.
