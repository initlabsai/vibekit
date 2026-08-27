```
█ █ █ █▄▄ █▀▀ █▄▀ █ ▀█▀
▀▄▀ █ █▄█ ██▄ █ █ █  █
```

VibeKit gives your AI agent the skills and tools to build on Algorand, and
gives you a terminal Explorer to watch it work.

Works with **Claude Code**, **Codex**, **Cursor**, **Copilot**, **Grok**,
**opencode**, and **pi**.

Alpha release — [feedback welcome](https://github.com/initlabsai/vibekit/issues).

## Requirements

| For | You need |
| --- | --- |
| VibeKit CLI | Nothing — a self-contained binary |
| VibeKit Explorer | Nothing — a self-contained binary |
| Keystore | Node.js, and your OS keychain |
| Starter templates | Node.js 24+ |
| LocalNet | Docker Compose v2 |

The keystore is what signs, so payments, assets, and deploys go through it. Its
daemon runs under Node and is installed once with `npm`. On Linux it needs a
Secret Service keychain; on Windows, the [Visual C++
Redistributable](https://learn.microsoft.com/en-us/cpp/windows/latest-supported-vc-redist)
(`winget install Microsoft.VCRedist.2015+.x64`).

The starter templates compile and test with `puya-ts`, `tsx`, and `vitest`. On
Linux, LocalNet also needs you in the `docker` group (`sudo usermod -aG docker
$USER`, then log out and back in).

`vibekit doctor` reports what is missing without changing anything.

## Quick start

macOS and Linux:

```bash
curl -fsSL https://getvibekit.ai/alpha | sh
```

Windows:

```powershell
irm https://getvibekit.ai/alpha.ps1 | iex
```

Both install the CLI and the Explorer sidecar. There is no stable release yet,
so `/alpha` and `/alpha.ps1` are `/install` and `/install.ps1` with the
prerelease channel pre-set.

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

## Platform support

| Platform              | Status |
| --------------------- | ------ |
| Linux (x64)           | Alpha  |
| macOS (Apple Silicon) | Alpha  |
| macOS (Intel)         | Alpha  |
| Windows (x64)         | Alpha  |

Development runs on Linux. The macOS and Windows binaries are built in CI and
have been run by hand; they are less exercised than Linux.

## Why VibeKit

AI coding assistants are bad at Algorand. They hallucinate APIs, reach for
outdated patterns, and cannot actually deploy or test anything.

`vibekit new` and `vibekit init` fix that. They install **skills** that teach
your agent current Algorand patterns, and wire up **MCP tools** that let it
touch the chain directly. Your agent can write a contract, deploy it to
LocalNet, mint test assets, call methods, and check the result. Ask it what
went wrong and it reads the chain to find out.

Keys never reach the model. Signing goes through a local keystore daemon over
a socket; the agent asks for a signature and never sees key material.

Who reviews a write depends on the host. In the Explorer, every write stops at
an approval screen showing the decoded group and its simulation. `vibekit mcp`
defaults to execute mode and signs without prompting — set `SIGNING=compose`
to get unsigned transaction groups back for a wallet to review instead.

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

## Package

The CLI is one host over a shared tool contract. The same tools ship as one
TypeScript package, `@initlabs/vibekit`, published to npm under the `alpha`
tag:

```bash
bun add @initlabs/vibekit@alpha
```

`.` is the tool contract (also at `./core`); `./tools`, `./tools/views`,
`./preset`, `./mcp`, `./mcp/stdio`, `./mcp/http`, `./agent`, `./agent/config`,
`./signer-keystore`, and `./plugins/<name>` are the rest.

`algosdk` and `zod` are the only required peers. Each subpath that wraps a
third-party SDK declares it as an optional peer, so you install what you use:

| Subpath | Install alongside |
| --- | --- |
| `.`, `./tools`, `./tools/views` | nothing more |
| `./mcp`, `./mcp/stdio`, `./mcp/http` | `@modelcontextprotocol/server` |
| `./agent` | `ai`, plus `@ai-sdk/anthropic`, `@ai-sdk/openai`, or `@ai-sdk/openai-compatible` |
| `./signer-keystore` | `@algorandfoundation/keystore-core`, `@algorandfoundation/keystore-node`, `@tanstack/store` |
| `./plugins/nfd` | `@txnlab/nfd-sdk` |
| `./plugins/alpha-arcade` | `@alpha-arcade/sdk` |
| `./preset` | all of the above |

## Development

[AGENTS.md](./AGENTS.md) is the map of the repository: what runs where, how a
tool call flows, the glossary, the rules, and the release procedure.

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
