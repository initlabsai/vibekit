---
title: Examples
description: Every runnable example, what it composes, and how to run it.
draft: false
---

Each file is typechecked with the package, so it cannot rot. Run them from
the repository root.

| file | composes | run |
| --- | --- | --- |
| [`stdio.ts`](https://github.com/initlabsai/vibekit/blob/main/packages/vibekit/examples/stdio.ts) | `serveMcpStdio` over the preset; keystore signing when `SIGNING=execute` | `bun packages/vibekit/examples/stdio.ts` |
| [`http.ts`](https://github.com/initlabsai/vibekit/blob/main/packages/vibekit/examples/http.ts) | `createMcpHttpHandler` under `Bun.serve`, compose mode | `bun packages/vibekit/examples/http.ts` |
| [`signer.ts`](https://github.com/initlabsai/vibekit/blob/main/packages/vibekit/examples/signer.ts) | MCP over HTTP in execute mode with a mnemonic as the `TransactionSigner` | `MNEMONIC=… bun packages/vibekit/examples/signer.ts` |
| [`action.ts`](https://github.com/initlabsai/vibekit/blob/main/packages/vibekit/examples/action.ts) | the action machine over `createHost` and the keystore: draft → approve → sign → confirm, no UI | `SENDER=… bun packages/vibekit/examples/action.ts` |
| [`rest.ts`](https://github.com/initlabsai/vibekit/blob/main/packages/vibekit/examples/rest.ts) | `createRestHandler` behind `createPaywall` | `X402_PAY_TO=… bun packages/vibekit/examples/rest.ts` |
| [`agent-http.ts`](https://github.com/initlabsai/vibekit/blob/main/packages/vibekit/examples/agent-http.ts) | `createAgentHandler` under `Bun.serve` with ZeroSignal as the model | `bun packages/vibekit/examples/agent-http.ts` |
| [`apps/reference`](https://github.com/initlabsai/vibekit/tree/main/apps/reference) | all of the above behind one server, and a React page over the components | `bun run --cwd apps/reference build && bun apps/reference/server.ts` |

Guides that walk through them: [run an action](../../guides/run-an-action/),
[compose a server](../../guides/compose-a-server/),
[REST and x402](../../guides/rest-and-x402/), [swap the
signer](../../guides/swap-the-signer/), [swap the
model](../../guides/swap-the-model/).
