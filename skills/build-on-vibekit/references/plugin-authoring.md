# Plugin authoring

A plugin factory returns a `ToolPlugin`: a unique name, a tool array, and
optionally a service and semantic view schemas. The deployment puts the service
at `ctx.services[plugin.name]` and combines the plugin's tools with its base
tools.

Use the nearest existing package as a pattern:

- `packages/vibekit/src/plugins/pera` — small HTTP service, output shaping, network guard,
  semantic view, and fake-service tests
- `packages/vibekit/src/plugins/nfd` — per-network client cache and normalization of unusual
  SDK failures
- `packages/vibekit/src/plugins/alpha-arcade` — configured factory options and a larger SDK
  integration

## Plugin shape

A plugin is a directory in the one published package: source in
`packages/vibekit/src/plugins/<name>/` with an `index.ts`, tests in
`packages/vibekit/test/plugins/<name>/`, and a `./plugins/<name>` entry in the
`exports` map of `packages/vibekit/package.json`. Add one only when there is a
current named consumer and owner approval.

The package declares `algosdk` and `zod` as peers; import core from
`@initlabs/vibekit` and tools from its subpaths. A third-party SDK the plugin
wraps is an optional peer dependency of the package (declared in
`peerDependencies` and `peerDependenciesMeta`, installed as a devDependency
for the workspace, and listed in the README's subpath table), so only
consumers of that subpath install it. Ask before adding any dependency.

## Implement the service boundary

Put stateful clients, caches, credentials, and remote calls behind a service
created by the plugin factory. Do not keep them in module-level mutable state.
Use a typed accessor that reads `ctx.services[PLUGIN_NAME]` and throws
`ToolError('PLUGIN_NOT_CONFIGURED', ...)` when the plugin is absent.

Validate network support at that accessor or service boundary and throw a
stable `UNSUPPORTED_NETWORK` error before calling an incompatible upstream.
Normalize third-party failures into user-safe `ToolError`s when the SDK does
not throw ordinary `Error` objects.

```ts
import {
  defineTool,
  ToolError,
  type ToolContext,
  type ToolPlugin,
} from "@initlabs/vibekit";
import { z } from "zod";

const PLUGIN_NAME = "example";

interface ExampleService {
  lookup(id: string): Promise<unknown>;
}

function getExample(ctx: ToolContext): ExampleService {
  const service = ctx.services[PLUGIN_NAME] as ExampleService | undefined;
  if (!service) {
    throw new ToolError(
      "PLUGIN_NOT_CONFIGURED",
      "The example plugin is not registered in this deployment",
    );
  }
  return service;
}
```

## Define structured tools

Every tool uses `defineTool()`. Give it a globally unique, action-oriented
name; a description that tells the model when to call it; described Zod
parameters; and an output schema for the post-`jsonSafe` result.

Set `requiresSigner` for tools that spend from a user account. Set
`mutatesState` for state changes that do not spend user funds, and `expensive`
for unusually large reads. These flags drive host approval annotations.

Use a coarse `view` hint such as `table` or `json` unless a trusted semantic
Explorer view already exists. A new semantic view is a separate protocol
change; do not invent one solely in the plugin. If the view exists, expose its
post-`jsonSafe` Zod schema in `plugin.views` under the same namespaced id.

## Return the plugin

```ts
export function examplePlugin(options: ExampleOptions = {}): ToolPlugin {
  const service = createExampleService(options);
  const tools = [lookupExampleTool];

  return {
    name: PLUGIN_NAME,
    description: "One-line description for deployment settings",
    tools,
    service,
  };
}
```

Factories make configuration explicit and keep each deployment independent.
Do not make importing the module create clients, read environment variables, or
perform network calls.

## Register and test

Instantiate the plugin in a deployment's `plugins` array. Do not copy its tools
into the deployment's base tool list. To ship it in every stock host at once,
add it to `defaultPlugins()` in `packages/vibekit/src/preset` — that is the one
registration point for the CLI hosts and the reference app; the TUI keeps its
own roster in `apps/tui/src/features/agent/session.ts`.

Tests should cover:

- factory name, tool names, flags, output schemas, and views
- missing-registration and unsupported-network errors
- handler output shaping with a fake service, without live network calls
- upstream edge cases and error normalization
- write composition and signer requirements when the plugin writes

Run the package gates from the repository root:

```bash
bun run --cwd packages/vibekit typecheck
bun run --cwd packages/vibekit test
```
