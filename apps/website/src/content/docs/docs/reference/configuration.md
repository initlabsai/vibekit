---
title: Configuration
description: The few settings that matter when using VibeKit.
draft: false
---


## Agent setup

`vibekit init` installs skills and MCP configuration into an existing project.
It asks which supported agent harnesses to configure, then preserves unrelated
MCP entries where the harness’s JSON format supports merging.

The Explorer’s optional model configuration lives at
`${XDG_CONFIG_HOME:-~/.config}/vibekit/config.json` (mode `0600`). It stores a
provider, model, and optional base URL. API keys are never written there.

These environment variables override the stored Explorer configuration.
`VIBEKIT_AGENT_MODEL` is the switch: the other three are only read when it is
set, and `VIBEKIT_AGENT_PROVIDER` defaults to `ollama`.

```text
VIBEKIT_AGENT_PROVIDER
VIBEKIT_AGENT_MODEL
VIBEKIT_AGENT_BASE_URL
VIBEKIT_AGENT_API_KEY
```

## Networks

The stock MCP reads `NETWORK` for its default network (`localnet`) and
`NETWORKS` for the comma-separated set of served networks, which replaces the
default set of `localnet,testnet,mainnet`. A multi-network deployment
adds a `network` parameter to every tool; it is required for writes.

Never rely on an active account or active network. Every write needs an
explicit sender and network.

## Signing

`vibekit mcp` defaults to execute mode, signing through the local keystore.
Set `SIGNING=compose` to return unsigned transaction groups instead. If the
keystore daemon is unreachable in execute mode, the server falls back to
compose and warns on stderr. Keys live in the OS keychain behind
`@algorandfoundation/keystore-node`, reached over a local socket at
`~/.algorand-keystore/keystore.sock`; they never enter model context.

Use `vibekit keystore status` to check the daemon and `vibekit doctor` to
diagnose the wider setup. Never put a mnemonic, seed, or private key in a
prompt, environment file, or agent configuration.
