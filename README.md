```
 ██    ██ ██ ██████  ███████ ██   ██ ██ ████████
 ██    ██ ██ ██   ██ ██      ██  ██  ██    ██
 ██    ██ ██ ██████  █████   █████   ██    ██
  ██  ██  ██ ██   ██ ██      ██  ██  ██    ██
   ████   ██ ██████  ███████ ██   ██ ██    ██
```

VibeKit gives your AI the skills and tools to build on Algorand with one command.

Works with **Claude Code**, **OpenCode**, **Cursor**, and **VS Code / Copilot**.

> **Note:** VS Code Copilot's "Agent Skills" feature is experimental and disabled by default. Enable it in Settings (search "agentskills"). For best results, use Claude Code or another dedicated coding agent.

Early release — [feedback welcome](https://github.com/gabrielkuettel/vibekit/issues).

## Quick Start

Install VibeKit:

```bash
# macOS / Linux
curl -fsSL https://getvibekit.ai/install | sh

# Windows (PowerShell)
irm https://getvibekit.ai/install.ps1 | iex
```

Run the setup wizard:

```bash
vibekit init
```

Verify setup:

```bash
vibekit status
```

Open your AI tool and start building.

## Platform Support

| Platform              | Status |
| --------------------- | ------ |
| macOS (Apple Silicon) | Tested |
| macOS (Intel)         | Tested |
| Linux (x64)           | Tested |
| Windows (x64)         | Tested |

## Why VibeKit

AI coding assistants are bad at Algorand. They hallucinate APIs, use outdated patterns and tools, and can't actually deploy or test anything.

`vibekit init` fixes this. It detects your AI tools and installs two things: **skills** that teach your AI current Algorand patterns, and **MCP tools** that let it interact with the blockchain directly.

Now your AI can build a marketplace contract, deploy it to LocalNet, create test assets, call methods, and verify state. Need to debug? Just ask and it pulls the indexer logs for you.

Keys stay safe. Account providers (Vault or OS Keyring) handle signing without exposing secrets to the AI.

## Documentation

Full documentation at **[getvibekit.ai](https://getvibekit.ai)**

- [Installation](https://getvibekit.ai/getting-started/installation)
- [Quick Start](https://getvibekit.ai/getting-started/quick-start)
- [How It Works](https://getvibekit.ai/getting-started/how-it-works)
- [CLI Reference](https://getvibekit.ai/cli-reference/init)

## CLI Commands

```bash
vibekit init               # Interactive setup wizard
vibekit status             # Show component status
vibekit mcp                # Run MCP server (for IDE integration)
vibekit remove             # Remove VibeKit configs

vibekit vault <cmd>        # Manage HashiCorp Vault
vibekit account <cmd>      # Dangerous account operations
vibekit dispenser <cmd>    # TestNet Dispenser auth

vibekit --version          # Show version
vibekit --help             # Show help
```

## Development

See [AGENTS.md](./AGENTS.md) for development guidance.

```bash
bun install          # Install dependencies
bun run build        # Build all packages
bun run typecheck    # Type check
bun run dev:cli      # Run CLI from source
```

## License

MIT
