# Custom MCP deployment

Use `packages/mcp/examples/` as the executable reference. VibeKit uses
`@modelcontextprotocol/server` v2 and the MCP `2026-07-28` stateless protocol.
A deployment is configuration: a set of tools, optional plugins, served
networks, compose or execute mode, and an optional signer. The MCP package
adapts that deployment to a transport.

The two standard transports remain distinct deployment choices:

- stdio is a local, client-launched subprocess. One server instance lives for
  that process-scoped connection.
- Streamable HTTP is the remote transport. Every message is its own POST and
  every request gets a fresh MCP server instance. Do not add an initialize
  handshake, `Mcp-Session-Id`, GET event stream, or session affinity.

Protocol statelessness does not prohibit pooled network clients or service
caches. It prohibits hidden client-session state. If an operation must carry
application state across calls, return an explicit opaque handle and require
the next tool call to pass it back.

## Work within the current boundary

Copy a file from `packages/mcp/examples/` into your own entry point; do not add a new app to this monorepo without owner approval.
Apps are independent deployment units, import only public `@initlabs/*`
exports through `workspace:*`, and never use relative imports into packages.
Packages must never depend on an app.

Keep one shared definition of the tool and plugin mix. The stock mix lives in
`@initlabs/vibekit-preset`: `defaultTools` (every domain), `defaultPlugins()`,
`withKeystoreTools()`, and `networksFromEnv()`; the CLI hosts and the reference
app compose from it. A custom deployment that wants a different mix composes
its own arrays the same way — extract one plain options factory rather than
copying the mix between entry points.

## Select the deployment

Pass these fields to the host adapter:

- `name` and optional `version` identify the MCP server.
- `network` is the default `NetworkId` or custom `NetworkConfig`.
- `networks` optionally serves more networks. VibeKit injects the `network`
  argument into tool schemas automatically; it is required for writes.
- `mode` is `compose` or `execute`.
- `tools` is an array of `ToolDefinition`s.
- `plugins` is an array of instantiated `ToolPlugin`s.
- `resolveSigner` is required when `mode` is `execute`.

Registry validation happens at startup. Duplicate plugin names, duplicate tool
names, and execute mode without a signer are configuration errors; do not defer
or suppress them.

Start in `compose` mode unless the deployment owns an appropriate signer.
Compose mode returns unsigned transaction groups for external signing.
Execute mode signs and sends through `resolveSigner` and must preserve the
host's approval boundary.

## Stdio host

Stdio is the local-agent path:

```ts
import { serveVibekitStdio } from "@initlabs/vibekit-mcp/stdio";
import { accountTools, networkTools } from "@initlabs/vibekit-tools";

const handle = serveVibekitStdio({
  name: "my-vibekit-mcp",
  network: "testnet",
  mode: "compose",
  tools: [...networkTools, ...accountTools],
  plugins: [],
});

process.on("SIGINT", () => void handle.close());
```

Write operational messages to stderr. Stdout belongs to the MCP transport.
Close the host and any signer or service resources during shutdown.

For execute mode, follow `packages/mcp/examples/stdio.ts`: create the signer, add any
signer-dependent tools, pass `resolveSigner`, and close the signer on exit. Do
not expose mnemonic or seed material to a tool handler.

## Stateless Streamable HTTP host

The HTTP adapter returns a `2026-07-28` stateless fetch handler. Its server
factory is invoked once per request:

```ts
import { createVibekitHttpHandler } from "@initlabs/vibekit-mcp/http";
import { accountTools, networkTools } from "@initlabs/vibekit-tools";

const handler = createVibekitHttpHandler({
  name: "my-vibekit-mcp",
  network: "testnet",
  mode: "compose",
  tools: [...networkTools, ...accountTools],
});

Bun.serve({ port: 8788, fetch: (request) => handler.fetch(request) });
```

The current adapter also accepts 2025-era clients through a stateless
compatibility path. It does not create or retain protocol sessions.

Keep public HTTP deployments in compose mode. Execute mode over HTTP is an
explicit self-hosting choice and requires authentication and an approval model
in front of the handler; the adapter does not provide those controls. Validate
the `Origin` header before forwarding requests. Bind local servers to
`127.0.0.1`; public deployments need an explicit origin policy and
authentication at the application or gateway boundary.

## Verify

From the repository root:

```bash
bun run --cwd packages/mcp typecheck
bun run mcp
```

Exercise startup with the intended environment and confirm the client sees
only the selected tools, plugins, and networks. Add focused tests when wiring
contains logic beyond declarative options.
