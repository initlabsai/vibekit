```
█ █ █ █▄▄ █▀▀ █▄▀ █ ▀█▀
▀▄▀ █ █▄█ ██▄ █ █ █  █
```

VibeKit gives your AI agent the skills and tools to build on Algorand, and
gives you a terminal Explorer to watch it work.

Works with **Claude Code**, **Codex**, **Cursor**, **Copilot**, **Grok**,
**opencode**, and **pi**.

Alpha release — [feedback welcome](https://github.com/initlabsai/vibekit/issues).

## Quick start

```bash
curl -fsSL https://getvibekit.ai/install | VIBEKIT_CHANNEL=alpha sh
```

Scaffold a project and set up your agent:

```bash
vibekit new my-app
```

Start a local chain and open the Explorer:

```bash
vibekit localnet start
vibekit explore
```

Then open your AI tool in the project and start building.

> Windows binaries are attached to each [release](https://github.com/initlabsai/vibekit/releases).
> The PowerShell installer is not ready yet.

## Platform support

| Platform              | Status |
| --------------------- | ------ |
| Linux (x64)           | Alpha  |
| macOS (Apple Silicon) | Alpha  |
| macOS (Intel)         | Alpha  |
| Windows (x64)         | Alpha  |

Development runs on Linux. macOS and Windows binaries are built in CI and are
less exercised.

## Why VibeKit

AI coding assistants are bad at Algorand. They hallucinate APIs, reach for
outdated patterns, and cannot actually deploy or test anything.

`vibekit new` and `vibekit init` fix that. They install **skills** that teach
your agent current Algorand patterns, and wire up **MCP tools** that let it
touch the chain directly. Your agent can write a contract, deploy it to
LocalNet, mint test assets, call methods, and check the result. Ask it what
went wrong and it reads the chain to find out.

Keys never reach the model. Signing goes through a local keystore daemon over
a socket, and every write pauses for your approval first. Signerless setups
return an unsigned transaction group for a wallet to review instead.

## The Explorer

`vibekit explore` opens a full-screen terminal Explorer: a chat transcript
with a live results feed. Type an address, asset id, or transaction id and it
resolves without a model call. Ask a question and the agent answers alongside
trusted result cards. Contracts get a card each — creator, state, bare
actions, live global state — and you can call any ABI method from the line,
with reads simulated inline and writes routed through an approval modal that
shows decoded arguments before you sign.

## Documentation

Full documentation at **[getvibekit.ai](https://getvibekit.ai)**

- [Your first project](https://getvibekit.ai/docs/tutorials/first-project)
- [Explore with VibeKit](https://getvibekit.ai/docs/tutorials/explore-with-vibekit)
- [Add VibeKit to a project](https://getvibekit.ai/docs/guides/add-to-an-existing-project)
- [How VibeKit works](https://getvibekit.ai/docs/explanation/how-vibekit-works)

## CLI commands

```bash
vibekit new [dir]          # Scaffold a project, then set up agents
vibekit init [dir]         # Set up agents in an existing project
vibekit explore            # Open the Explorer TUI
vibekit localnet <cmd>     # Manage the local Algorand network
vibekit doctor             # Diagnose setup problems (--fix repairs them)
vibekit keystore <cmd>     # Signing accounts and the keystore daemon
vibekit dispenser <cmd>    # TestNet dispenser session
vibekit tool <name> [json] # Call any VibeKit tool from the shell
vibekit mcp                # Run the MCP server over stdio
```

Templates for `vibekit new`: `contracts`, `fullstack`, `kitchensink`.

## Packages

The CLI is one host over a shared tool contract. The same tools are available
as TypeScript packages — `@initlabs/vibekit-core`, `-tools`, `-mcp`, `-agent`,
`-signer-keystore`, `-preset`, and the plugins — published to npm under the
`alpha` tag.

## Development

See [AGENTS.md](./AGENTS.md) for development and release guidance.

```bash
bun install
bun run build
bun run typecheck
bun run test
bun run cli -- --help
```

- [Constitution](./docs/CONSTITUTION.md) — the bets the project rests on
- [Contributing](./CONTRIBUTING.md) — conventions and review

## License

MIT
