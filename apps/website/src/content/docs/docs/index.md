---
title: vibekit // field manual
description: Get an agent onto Algorand without handing it the keys.
draft: false
banner:
  content: '<strong>VibeKit is in alpha.</strong> The package is unstable and not ready to build on — APIs will break without notice.'
---

:::danger[Alpha — not ready to build on]
VibeKit is an alpha release. `@initlabs/vibekit` is published under the `alpha`
dist-tag, carries **no API stability guarantee**, and will change in breaking
ways without a major version bump. The Explorer presentation protocol is not
frozen.

Use this to try VibeKit and tell us what breaks. Do not build something you
need to keep working.
:::

VibeKit gives your coding agent the parts it usually has to guess at: current
Algorand guidance, typed chain tools, LocalNet, and a signer that keeps seeds
out of model context.

Pick a hatch:

- **Building an agent?** [Build an agent](./tutorials/build-an-agent/) — your
  own endpoint, the components, signing — then [compose a
  server](./guides/compose-a-server/) and [run an
  action](./guides/run-an-action/). The [examples](./reference/examples/) are
  the reference; the [tools](./reference/tools/) page is generated from the
  code.
- **Using a coding agent?** [Build your first
  project](./tutorials/first-project/) or [add VibeKit to an existing
  one](./guides/add-to-an-existing-project/); [explore with
  VibeKit](./tutorials/explore-with-vibekit/) to watch it work.
- **Extending it?** [Make a plugin](./guides/create-a-vibekit-plugin/) or
  [compose a custom MCP](./guides/create-a-custom-mcp/).

Why it is shaped this way: [Why VibeKit](./explanation/why-vibekit/), then
[queries and actions](./explanation/queries-and-actions/).

## what's in the box

The CLI can create a project, configure the coding agent you already use, and
run a local Algorand network. MCP gives that agent typed tools for accounts,
assets, transactions, contracts, and network data.

The Explorer is the hands-on console: look up real chain data, watch live
blocks, and stop at the review screen before a transaction is signed.

Your agent can ask for a transaction. It never gets the seed. That's the deal.

Read [how VibeKit works](./explanation/how-vibekit-works/) when you want to see
how those parts connect.
