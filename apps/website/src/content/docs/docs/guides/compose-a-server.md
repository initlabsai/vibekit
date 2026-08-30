---
title: Compose a server
description: The agent, the action routes, REST, MCP, and a paywall — under one Bun.serve.
draft: false
---

Every piece is a function of a `Request`, so composing them is routing.
[`apps/reference/server.ts`](https://github.com/initlabsai/vibekit/blob/main/apps/reference/server.ts)
is the whole thing in 45 lines; this is the shape.

## The pieces

```ts
import { createActionRoutes } from '@initlabs/vibekit/actions'
import { createAgentHandler } from '@initlabs/vibekit/agent'
import { createMcpHttpHandler } from '@initlabs/vibekit/mcp/http'
import { createPaywall, memoryStore } from '@initlabs/vibekit/pay'
import { createHost, defaultPlugins, defaultTools } from '@initlabs/vibekit/preset'
import { createRestHandler } from '@initlabs/vibekit/rest'

const deployment = { network: 'testnet', mode: 'compose', tools: defaultTools, plugins: defaultPlugins() } as const

const agent = createAgentHandler({ ...deployment, model: { provider: 'zerosignal', model: 'qwen3:8b' } })
const rest = createRestHandler(deployment)
const mcp = createMcpHttpHandler({ name: 'mine', ...deployment })
const actions = createActionRoutes({ hostFor: () => host })
const host = createHost('testnet')
const paywall = createPaywall({ chain: 'testnet', payTo: HOUSE, store: memoryStore() })
```

The same `deployment` object feeds the agent, REST, and MCP: one tool list,
one network, one mode. `createHost` builds its own over the stock tools for
the action routes; `createActionRoutes` needs an `ActionHost` that can also
broadcast and poll, which is what a host is.

## The routing

```ts
Bun.serve({
  async fetch(request) {
    const { pathname } = new URL(request.url)
    if (pathname === '/buy') return paywall.buy(request)
    if (pathname === '/api/actions') return actions(request)             // free: approval flow steps
    if (pathname === '/api/tools') return Response.json({ tools: rest.catalogue() })
    // Everything below costs a turn: free ones by IP first, then a bought pack, else 402.
    const charge = await paywall.charge(request)
    if (!charge.ok) return charge.response
    if (pathname === '/api/agent') return agent.fetch(request)
    if (pathname === '/api/mcp') return mcp.fetch(request)
    const tool = pathname.match(/^\/api\/tools\/([a-z0-9_]+)$/)?.[1]
    if (tool) return rest.call(tool, request)
    return new Response('Not found', { status: 404 })
  },
})
```

Three decisions are visible in the routing and nowhere else:

- **What costs a turn.** The paywall is a line in front of a route, not a
  property of the handler. The reference app charges nothing; the web agent
  charges the agent, REST, and MCP `tools/call`, and leaves the browser's own
  reads and approval steps free.
- **What can sign.** Nothing. Every handler was built in compose mode; the
  action routes verify a wallet's bytes against the draft and broadcast. To
  sign server-side, a deployment takes `mode: 'execute'` and a
  `resolveSigner` — see [swap the signer](../swap-the-signer/) — and you put
  auth in front of it.
- **Where the model is.** One option on one handler. See [swap the
  model](../swap-the-model/).

## Next

[Run an action](../run-an-action/) to see what the action routes are serving;
[REST and x402](../rest-and-x402/) for the paywall's store and credit rules.
