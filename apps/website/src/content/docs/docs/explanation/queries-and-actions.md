---
title: Queries and actions
description: Why a tool is one or the other, and why the agent never holds a key.
draft: false
---

Every VibeKit tool is a **query** or an **action**. A query reads and nothing
leaves the process. An action drafts a transaction group — a payment, a swap,
an app call — and that is all it can do by itself. Between the draft and the
chain sit a simulation, a human's approval, and a wallet's signature, each
recorded, each referencing the one before it. The approval names the
simulation it reviewed; the signature wraps the exact drafted bytes; a
signature over anything else is refused, not recorded.

This is why the model never sees a key and why "the agent did something on
chain" is never true. The agent proposed; the machine walked
`draft → simulated → inspected → awaiting-approval → approved → signed → confirmed`;
a person and a wallet did the two steps that matter.

The split is derived, not declared: an action is any tool with
`requiresSigner` or `mutatesState`. MCP marks them destructive, the agent
gates them, REST returns the draft, and the reference lists them apart — all
from the same flag.

It also settles what a component is: a renderer for one tool's output. If a
component needs logic the output lacks, the tool should return it, so the
next surface gets it too.
