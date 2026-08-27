---
title: Create a VibeKit plugin
description: Package a new capability as typed tools that any VibeKit host can use.
draft: false
---


A VibeKit plugin is a workspace package that returns a `ToolPlugin`: a name, a tool
array, and optionally a service or trusted Explorer view schemas. The host puts
the plugin service at `ctx.services[plugin.name]` and sends every call through
the same tool contract as VibeKit’s built-in capabilities.

## Start with one tool

This minimal plugin makes the shape concrete. In a real package, name the tool
for the capability it performs and give its parameters and output meaningful
schemas.

```ts
import { defineTool, type ToolPlugin } from '@initlabs/vibekit-core'
import { z } from 'zod'

const echoTool = defineTool({
  name: 'example_echo',
  description: 'Echo a value. Use only when testing the example plugin.',
  parameters: z.object({
    value: z.string().describe('The value to echo.'),
  }),
  output: z.object({ value: z.string() }),
  view: 'json',
  async handler(_ctx, { value }) {
    return { value }
  },
})

export function examplePlugin(): ToolPlugin {
  return {
    name: 'example',
    description: 'A minimal example capability.',
    tools: [echoTool],
  }
}
```

Use `defineTool()` for every tool. Its output schema describes the wire result
after VibeKit has made it JSON-safe: bytes are base64 and large integers may be
decimal strings. Throw `ToolError` from a handler for a user-safe failure;
never return an `{ error }` result.

## Add a service when the capability needs state

Remote clients, credentials, and caches belong behind a service built by the
plugin factory. Do not create them at module import time. A typed accessor
should read the service from `ctx.services` and throw
`ToolError('PLUGIN_NOT_CONFIGURED', ...)` when the plugin is absent.

Plugin packages declare `@initlabs/vibekit-core`, `zod`, and `algosdk` as peer
dependencies. Keep the plugin’s own SDKs in regular dependencies. A factory is
the configuration boundary: importing a plugin must not read environment
variables, perform a network request, or mutate global state.

## Mark writes honestly

Set `requiresSigner` on a tool that spends user funds. Set `mutatesState` for a
state change that does not spend funds. These flags tell the host when to ask
for approval. In a compose deployment, write tools return an unsigned group;
an execute deployment requires a signer and is responsible for its approval
boundary.

Use a coarse `view` such as `json` or `table` unless your result conforms to an
Explorer semantic view that already exists. A new trusted semantic view is a
protocol change, not a decorative plugin feature.

## Register and test it

Instantiate the factory in a deployment’s `plugins` array. Do not spread a
plugin’s tools into the base tool list. Test the factory, schemas, flags,
missing-plugin error, and the service’s edge cases with fakes rather than live
network calls.

The first-party plugins in `packages/plugin-pera`, `packages/plugin-nfd`, and
`packages/plugin-alpha-arcade` are the current implementation patterns.
