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
`~/.config/vibekit/config.json`. It stores a provider, model, and optional base
URL. API keys are never written there.

These environment variables override the stored Explorer configuration:

```text
VIBEKIT_AGENT_PROVIDER
VIBEKIT_AGENT_MODEL
VIBEKIT_AGENT_BASE_URL
VIBEKIT_AGENT_API_KEY
```

## Networks

The stock MCP reads `NETWORK` for its default network and `NETWORKS` for a
comma-separated set of additional served networks. A multi-network deployment
adds a `network` parameter to every tool; it is required for writes.

Never rely on an active account or active network. Every write needs an
explicit sender and network.

## Signing

The stock MCP reads `SIGNING=execute` to use the local keystore signer;
otherwise it uses compose mode. Compose returns unsigned transaction groups.
Execute mode signs and submits through the keystore, whose private material
stays behind its local daemon.

Use `vibekit keystore status` to check the daemon and `vibekit doctor` to
diagnose the wider setup. Never put a mnemonic, seed, or private key in a
prompt, environment file, or agent configuration.
