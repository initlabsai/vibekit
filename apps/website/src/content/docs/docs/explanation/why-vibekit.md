---
title: Why VibeKit
description: Agents are going to act on chains. The question is who holds the key.
draft: false
---

Agents are going to act on chains. They will look things up, move money, call
contracts, trade. The interesting question is not whether — it is *who holds
the key* while they do it.

Most answers put the key somewhere near the model: in an environment variable,
in a wallet the agent controls, in a prompt. That works until the model is
wrong, or lied to, or just confident. VibeKit's answer is that nobody in the
loop holds the key except the person's own wallet, and the whole toolkit is
shaped so that stays true no matter how the agent is built or where it runs.

## One idea

A chain capability is a typed tool: a name, a description, an input schema, an
output schema, a handler. That is the atom. Everything else — the MCP server,
the agent loop, the REST endpoint, the CLI, the terminal, the web app — is an
adapter that reads the schema and calls the handler. Nothing reimplements a
capability; nothing has a private way to do something the tools cannot.

This is why the [tools reference](../../reference/tools/) is generated, why
`curl` and Claude and the web agent see the same thing, and why a plugin you
write today shows up in every surface tomorrow.

## Two kinds of tool

A **query** reads. It cannot spend, cannot change state, and needs no
approval. An **action** drafts a transaction group — a payment, a swap, an app
call — and that is all it can do on its own.

Between the draft and the chain sit a simulation, a person's approval, and a
wallet's signature. Each is a record; each references the one before it. The
approval names the exact simulation it reviewed. The signature wraps the exact
bytes that were drafted, and a signature over anything else is refused, not
recorded. The model proposes; the machine walks
`draft → simulated → inspected → awaiting-approval → approved → signed → confirmed`;
a person and a wallet do the two steps that matter.

The split is not something an author declares. An action is any tool that
needs a signer or mutates state, so MCP marks it destructive, the agent gates
it, REST returns the draft, and the docs list it apart — from one flag.

## Honest all the way down

The rule extends past the server. A component renders one tool's output and
nothing else, so a UI cannot show a balance the chain did not report. The
approval screen renders the *decoded bytes* of the draft — the same bytes the
wallet is handed — not what the model said it was doing. And the companion's
face changes on what actually happened, never on a model's guess.

## What it enables

- **Your own agent, in an afternoon.** `createAgentHandler` is one HTTP
  endpoint; `vibekit add` gives you the screens; any OpenAI-compatible model
  plugs in. The [reference app](../../reference/examples/) is about two
  hundred lines.
- **Selling access.** `createPaywall` turns an x402 payment in USDC into
  credit and charges a turn per call — in front of the agent, REST, or MCP.
- **Any signer, any surface.** A keystore daemon on a laptop, a browser
  wallet, a hardware device, a phone app that approves from across the room:
  all the same `TransactionSigner`, plugged in at one of two sockets.
- **Trust that survives the demo.** The web agent is built from these pieces
  and nothing else — its server is a few hundred lines of mounts — so what
  you read here is what runs there.

## What it is not

It is not a framework. Nothing calls you; you call it. There is no lifecycle,
no config file, no directory convention. It is not a wallet, and will not
become one. It is not a model; it is the room the model works in, with the
keys kept outside the door.
