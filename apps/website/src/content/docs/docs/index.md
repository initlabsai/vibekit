---
title: vibekit // field manual
description: Get an agent onto Algorand without handing it the keys.
draft: false
banner:
  content: '<strong>VibeKit is in alpha.</strong> The packages are unstable and not ready to build on — APIs will break without notice.'
---

:::danger[Alpha — not ready to build on]
VibeKit is an alpha release. The `@initlabs/*` packages are published under the
`alpha` dist-tag, carry **no API stability guarantee**, and will change in
breaking ways without a major version bump. The Explorer presentation protocol
is not frozen. macOS and Windows are not yet verified.

Use this to try VibeKit and tell us what breaks. Do not build something you
need to keep working.
:::

VibeKit gives your coding agent the parts it usually has to guess at: current
Algorand guidance, typed chain tools, LocalNet, and a signer that keeps seeds
out of model context.

Pick a hatch:

- [Build your first project](./tutorials/first-project/) — new TypeScript
  project, configured agent, running LocalNet.
- [Explore with VibeKit](./tutorials/explore-with-vibekit/) — ask the chain a
  question, follow live blocks, or review a write.
- [Add VibeKit to an existing project](./guides/add-to-an-existing-project/) —
  bring the tools and skills to the codebase you already have.

Got your own capability? [Make it a plugin](./guides/create-a-vibekit-plugin/).
Need a different tool mix? [Compose a custom MCP](./guides/create-a-custom-mcp/).

## what's in the box

The CLI can create a project, configure the coding agent you already use, and
run a local Algorand network. MCP gives that agent typed tools for accounts,
assets, transactions, contracts, and network data.

The Explorer is the hands-on console: look up real chain data, watch live
blocks, and stop at the review screen before a transaction is signed.

Your agent can ask for a transaction. It never gets the seed. That's the deal.

Read [how VibeKit works](./explanation/how-vibekit-works/) when you want to see
how those parts connect.
