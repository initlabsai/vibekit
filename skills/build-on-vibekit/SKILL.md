---
name: build-on-vibekit
description: Extend VibeKit from its source workspace. Use when defining VibeKit tools, building a ToolPlugin package, composing a deployment, or exposing a custom deployment through stdio or HTTP MCP. Covers the current packages/vibekit/examples and packages/vibekit/src/plugins/* patterns. Do not use for routine CLI or on-chain operations inside a VibeKit-initialized project.
---

# Build on VibeKit

VibeKit exposes one `ToolDefinition` contract through every host. Extend that
contract, compose tools and plugins into a deployment, then select a host. Do
not create a parallel handler or execution path.

## Current distribution boundary

Everything ships as one package, `@initlabs/vibekit`, with subpath exports
(`.` is the core contract; `./tools`, `./preset`, `./mcp`, `./agent`,
`./signer-keystore`, `./plugins/<name>`). Build against this monorepo using
its `workspace:*` dependency. Do not invent install, publish, or versioning
instructions for external consumers.

Before changing structure, read the repository `AGENTS.md` and
`docs/CONSTITUTION.md`. Ask before adding a dependency, package, app, registry, or
extension point.

## Choose the guide

| Task                                                                                           | Guide                                              |
| ---------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Select tools and plugins, configure networks or signing, and expose a custom stdio or HTTP MCP | [Custom MCP deployment](references/custom-mcp.md)  |
| Define tools, integrate an external service, and package them as a reusable plugin             | [Plugin authoring](references/plugin-authoring.md) |

Load only the guide needed for the current task. A custom MCP may consume an
existing plugin; plugin work does not require changing a host.

## Non-negotiable contracts

- Define every tool with `defineTool()` and give every parameter a Zod schema
  and useful `.describe()` text.
- Tool handlers receive all runtime state through `ToolContext`. Do not keep
  module-level mutable state or mutate the context.
- Throw `ToolError` with a stable code for expected failures. Never return an
  `{ error }` result from a handler.
- Describe the post-`jsonSafe` wire shape in `output`: bigint values become
  numbers or decimal strings and bytes become base64.
- Every host must execute tools through `executeToolCall`; use the existing MCP
  adapter rather than registering bespoke handlers.
- Build writes through `packages/vibekit/src/core/compose/`. Stop if a write requires a
  side path around that engine.
- Keep tool results structured. Tools do not return JSX, HTML, or terminal
  markup.
- Land tests with code. Run the affected package tests and typecheck, then the
  repository gate required by `AGENTS.md`.

## Source map

- `packages/vibekit/src/core/contract.ts` — `ToolDefinition`, `ToolContext`, and
  `ToolPlugin`
- `packages/vibekit/src/core/deployment.ts` — registry validation, network contexts,
  and `executeToolCall`
- `packages/vibekit/src/mcp/` — the generic ToolDefinition-to-MCP adapter
- `packages/vibekit/src/preset/` — the batteries-included mix (default tools, default
  plugins, keystore tools, NETWORK env convention) the stock hosts compose from
- `packages/vibekit/examples/` — the reference stdio and HTTP deployments, typechecked with the package
- `packages/vibekit/src/plugins/nfd/` and `.../pera/` — service-backed plugin
  examples with output schemas, network guards, and tests
