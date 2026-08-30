---
title: REST and x402
description: Expose queries over HTTP and charge for them in USDC.
draft: false
---

Two primitives. `createQueryHandler` runs any tool from a JSON body;
`createPaywall` turns an x402 payment into credit and takes a turn per call.
Put the second in front of the first — or in front of the agent, or MCP over
HTTP; it is the same `charge(request)`.

The working example is
[`packages/vibekit/examples/rest.ts`](https://github.com/initlabsai/vibekit/blob/main/packages/vibekit/examples/rest.ts):

```ts
import { createPaywall, memoryStore } from '@initlabs/vibekit/pay'
import { createQueryHandler } from '@initlabs/vibekit/rest'

const rest = createQueryHandler({ network: 'testnet', mode: 'compose', tools: defaultTools })
const paywall = createPaywall({ chain: 'testnet', payTo: HOUSE_ADDRESS, priceMicroUsdc: 1_000_000, turnsPerPack: 25, store: memoryStore() })

// POST /buy   → 402 with the requirements; a paid retry credits the payer
// POST /query/<tool> → charge a turn (free ones first), then run the tool
const charge = await paywall.charge(request)
if (!charge.ok) return charge.response
return rest.call(name, request)
```

- `store` is three functions (`incrBy`, `get`, `set`); swap the memory one for
  KV or Redis to survive restarts.
- Credits follow the **settled amount**, never a count the caller sent.
- Actions over REST return the draft. Nothing signs over HTTP.
- `rest.catalogue()` lists every tool with a JSON Schema — the same shape the
  [reference](../../reference/tools/) is generated from.

x402 support is an optional peer: `bun add @x402/core @x402/avm`.
