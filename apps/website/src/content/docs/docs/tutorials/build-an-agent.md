---
title: Build an agent
description: An Algorand agent with its own HTTP endpoint, in about ten minutes and under forty lines.
draft: false
---

:::note[Alpha]
The package is under the `alpha` dist-tag and its API moves. The shape below is
what exists today; the [tools reference](../../reference/tools/) is generated
from the code and stays current.
:::

You will run the same agent that powers [the web agent](https://agent.getvibekit.ai) —
every query and action, a model you choose — as your own endpoint, then add a
component to render what it says.

## 1. The endpoint

```bash
mkdir my-agent && cd my-agent && bun init -y && bun add @initlabs/vibekit@alpha
```

`agent.ts`:

```ts
import { createAgentHandler } from '@initlabs/vibekit/agent'
import { defaultPlugins, defaultTools } from '@initlabs/vibekit/preset'

const agent = createAgentHandler({
  model: { provider: 'openai-compatible', baseUrl: process.env.AGENT_BASE_URL!, apiKey: process.env.AGENT_API_KEY!, model: process.env.AGENT_MODEL! },
  network: 'testnet',
  mode: 'compose', // actions draft; nothing here can sign
  tools: defaultTools,
  plugins: defaultPlugins(),
})

Bun.serve({ port: 8790, fetch: (request) => agent.fetch(request) })
```

Any OpenAI-compatible endpoint works; `{ provider: 'zerosignal', model }` uses a
local ZeroSignal daemon with no key at all.

```bash
AGENT_BASE_URL=https://api.together.xyz/v1 AGENT_API_KEY=… AGENT_MODEL=Qwen/Qwen2.5-72B-Instruct-Turbo bun agent.ts
curl -N :8790 -d '{"input":"what is asset 10458941?"}'
```

The reply is NDJSON: `text-delta`, `tool-call`, `tool-result`, `finish`, then
`messages` — the turn's new history, which you send back as `history` next time.
Ask it to pay someone and a `draft` event arrives instead of a signature: an
unsigned group with everything an approval screen needs.

## 2. Render it

```bash
vibekit add tool-result transaction approval
```

Three files land in `components/`. `ToolResult` takes any `tool-result` event;
`Transaction` takes a `transaction.detail` result; `ActionApproval` takes a
`draft` record's data and two callbacks. They are yours now — restyle the
`vk-*` classes or rewrite them.

## 3. Sign it

A draft becomes a transaction only when someone signs. In a browser that is the
user's wallet: `createWalletSignDraft` in `@initlabs/vibekit/actions` turns
use-wallet's `transactionSigner` into the `signDraft` the action machine calls
after approval. On a server it is any `algosdk.TransactionSigner` — see
[swap the signer](../../guides/swap-the-signer/).

The agent never holds a key. That is the whole design.

## What next?

- Charge for turns: [REST and x402](../../guides/rest-and-x402/).
- The full list of what it can do: [tools](../../reference/tools/).
- Why it is shaped this way: [queries and actions](../../explanation/queries-and-actions/).
