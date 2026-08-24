---
title: How VibeKit works
description: The small mental model behind VibeKit’s CLI, MCP, plugins, and Explorer.
draft: false
---


VibeKit has one idea at its center: a blockchain capability is a typed tool.
The same tool can be called from an MCP server, the CLI, an agent loop, or a
terminal interface. Hosts do not reimplement the capability; they all send the
call through `executeToolCall`.

## Tools and deployments

A tool has Zod parameters, an output schema, a handler, and a few honest
annotations: whether it spends funds, changes state, or is unusually expensive.
A deployment chooses which tools and plugins to expose, which networks to
serve, and whether writes compose or execute.

This makes a custom MCP mostly configuration instead of a second implementation
of the chain integration.

## Plugins

A plugin is an npm package that returns more tools and, when needed, one
service object. The deployment passes that service to handlers through their
context. This keeps remote clients and caches scoped to a deployment rather
than hidden in module state.

## Compose and execute

Write tools use VibeKit’s compose engine. In compose mode, a write returns the
unsigned transaction group so another signer can review and sign it. In execute
mode, the deployment provides a signer and the host takes responsibility for
approval before submitting.

The standard local signer is a managed keystore daemon. The agent can request a
write, but it does not receive a mnemonic or private key.

## The Explorer

The terminal Explorer is a host over the same capabilities. It treats direct
identifiers deterministically, groups agent requests with their structured
results, and renders trusted views from tool data. A write pauses at an
approval screen that shows the actual group and its simulation before the local
signer can continue.
