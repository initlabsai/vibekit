---
title: How VibeKit works
description: "The small mental model: tools, deployments, records, and the adapters over them."
draft: false
---

VibeKit has one idea at its center: a chain capability is a typed tool, and
every surface is an adapter over the same tools. Hosts do not reimplement the
capability; they all send the call through `executeToolCall`.

## Tools and deployments

A tool has Zod parameters, an output schema, a handler, and a few honest
annotations: whether it spends funds, changes state, or is unusually expensive.
A **deployment** chooses which tools and plugins to expose, which networks to
serve, and whether actions compose (return an unsigned group) or execute (sign
with a signer the deployment was given). Validation, per-network clients, and
the injected `network` parameter come from `resolveDeployment`, once, for
every adapter.

## Plugins

A plugin returns more tools and, when needed, one service object the
deployment passes to handlers through their context. Remote clients and
caches stay scoped to a deployment rather than hidden in module state.

## Records

Once a host has a tool's output, it becomes a **record**: the output, the
tool that produced it, the network, the input, a version. Records reference
each other — an approval references the simulation it reviewed, a signature
references the draft it wraps. That is what makes an action auditable and what
lets a view model refuse to render facts that do not agree.

## The adapters

| surface | subpath | what it is |
| --- | --- | --- |
| MCP over stdio or HTTP | `mcp` | tools as MCP tools; actions marked destructive |
| the agent loop, and as HTTP | `agent` | a model over the tools; a turn per POST, NDJSON back |
| REST | `rest` | `POST /tools/<name>`; actions return the draft |
| a paywall | `pay` | x402 → credit → a turn per call, in front of any of the above |
| the action machine | `actions` | draft → approve → sign → confirm, as records, over any host |
| view models | `views` | records as what a card renders; a graph for a group |
| the stock wiring | `preset` | default tools and plugins, `createHost`, the Explorer agent |
| the CLI | — | `vibekit tool <name>` from a shell; `vibekit add` for components |

The terminal Explorer and the web agent are two apps over these; neither has
a path to the chain the adapters lack.
