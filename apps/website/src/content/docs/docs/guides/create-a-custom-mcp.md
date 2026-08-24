---
title: Create a custom MCP
description: Serve exactly the VibeKit tools and plugins your agent needs.
draft: false
---


A VibeKit MCP deployment is configuration: select tools, optional plugins,
networks, and a signing mode, then pass that deployment to a transport adapter.
Copy the executable examples in `packages/mcp/examples/` when starting a real
server.

## Start with a focused stdio server

This server exposes only account and network reads on TestNet. Stdio is the
normal local-agent transport.

```ts
import { serveVibekitStdio } from '@initlabs/vibekit-mcp/stdio'
import { accountTools, networkTools } from '@initlabs/vibekit-tools'

const handle = serveVibekitStdio({
  name: 'my-vibekit-mcp',
  network: 'testnet',
  mode: 'compose',
  tools: [...networkTools, ...accountTools],
})

process.on('SIGINT', () => void handle.close())
```

For the full stock tool surface, import `defaultTools` and `defaultPlugins()`
from `@initlabs/vibekit-preset`. Keep that selection in one plain factory if
more than one entry point needs it.

## Choose compose before execute

Use `compose` unless the deployment owns a signer and a real approval boundary.
Compose mode returns unsigned transaction groups for an external signer to
review. It is the correct default for a new server and for public HTTP use.

`execute` requires `resolveSigner`; startup rejects an execute deployment
without it. A local stdio deployment can use the VibeKit keystore pattern from
`packages/mcp/examples/stdio.ts`. Do not put a signer behind an unauthenticated
HTTP endpoint.

## Add a plugin

Instantiate plugins through the deployment rather than copying their tools:

```ts
import { nfdPlugin } from '@initlabs/vibekit-plugin-nfd'

const handle = serveVibekitStdio({
  name: 'my-vibekit-mcp',
  network: 'testnet',
  mode: 'compose',
  tools: [...networkTools, ...accountTools],
  plugins: [nfdPlugin()],
})
```

VibeKit validates duplicate plugin names and duplicate tool names when the
deployment starts. With multiple networks, it injects a `network` parameter
into every tool and requires it on writes.

## HTTP is an adapter, not another architecture

Use `createVibekitHttpHandler` from `@initlabs/vibekit-mcp/http` when your own
application needs a stateless Streamable HTTP handler. The handler creates a
fresh MCP server per request; it does not retain client sessions. Bring your
own authentication, origin policy, and deployment model. The
[MCP server documentation](https://modelcontextprotocol.io/docs/develop/build-server)
covers those generic hosting concerns.
