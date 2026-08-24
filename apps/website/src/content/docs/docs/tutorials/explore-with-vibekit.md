---
title: Explore with VibeKit
description: Use the terminal Explorer to inspect Algorand and review writes.
draft: false
---

The VibeKit Explorer is a full-screen terminal app for Algorand. It is useful
before you configure a model: direct identifiers route to chain lookups without
an agent call.

![The VibeKit Explorer welcome screen, with its direct-lookup and write-flow shortcuts.](/images/explorer-welcome.png)

## Configure the optional chat lane

To use natural-language requests, choose an inference provider and model:

```bash
vibekit explore setup
```

The setup stores only the provider, model, and optional base URL in the VibeKit
config file. API keys stay in your environment. The Explorer supports
ZeroSignal, Ollama, Anthropic, OpenAI, and OpenAI-compatible endpoints.

### ZeroSignal

ZeroSignal is the smoothest route when you want a provider that works through
its local `zs-proxy` rather than an API key. Follow the
[ZeroSignal setup guide](https://txnlab.gitbook.io/zerosignal) to install the
proxy, start it, and fund it if needed. Then run `vibekit explore setup`.
VibeKit probes the local proxy and lets you select from its live text-model
catalog; it does not write an API key to disk.

## Open the Explorer

```bash
vibekit explore
```

The command starts the local daemon support it needs, then opens the TUI. From
a source checkout, use the TUI development command described in
[installation](../reference/installation/).

## Start with direct lookups

Paste or type an Algorand address, transaction ID, asset ID, application ID,
block round, or an NFD such as `vibekit.algo`. The Explorer recognizes these
inputs and opens a structured result without sending them to a language model.

Use the network control to switch among LocalNet, TestNet, and MainNet. The
result remains tagged with the network that produced it.

## Use the chat lane when it helps

Ask a narrow question such as “show the latest block” or “list my accounts.”
The chat transcript keeps each request with its result cards. The agent can
select tools and explain the result; it cannot generate UI code or bypass the
Explorer’s write flow.

## Review every write

When a request composes a transaction group, the Explorer stops at a modal that
shows the actual unsigned group, simulation, sender, network, fees, and visible
effects. Inspect it, then explicitly approve or decline it. Only the local
keystore can sign after approval; the model never receives key material.

The browser Explorer and browser-wallet flow are not part of this documentation
because they are not a public product path yet.
