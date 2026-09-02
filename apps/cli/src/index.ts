/**
 * vibekit — AI-assisted development environment for Algorand.
 */

import pc from 'picocolors'
import { amber, teal } from './brand.js'

import { LOGO } from './logo.js'
import { VERSION } from './version.js'

function showHelp(): void {
  console.log(`
${pc.bold('VibeKit')} — Deploy contracts. Manage assets. Query the chain. All through your favorite AI agent.

${pc.bold('Usage:')}
  vibekit init [dir]          Set up AI coding agents (skills, MCP config)
  vibekit new [dir]           Scaffold a project from a starter template
  vibekit localnet <cmd>      Manage the local Algorand network (Docker)
  vibekit explore             Open the full-screen Explorer TUI
  vibekit explore setup       Configure the Explorer's agent model (provider, model)
  vibekit doctor              Diagnose setup problems (--fix repairs them)
  vibekit tool <name> [json]  Call any VibeKit tool from the shell (tool list to browse)
  vibekit dispenser <cmd>     TestNet dispenser session: login | status | logout
  vibekit keystore <args>     Managed keystore CLI (auto-provisioned, pinned — no global install)
  vibekit mcp                 Run the MCP server over stdio (for agent integration)
  vibekit add <component…>    Copy a React component's source into ./components (add --list to browse)

${pc.bold('LocalNet Commands:')}
  localnet start              Start LocalNet
  localnet stop               Stop LocalNet
  localnet reset              Recreate LocalNet (--update pulls new images)
  localnet status             Show container + node health
  localnet fund <addr>        Fund an account from the dispenser
  localnet logs               Show container logs

${pc.bold('Templates:')}
  vibekit new --template contracts|fullstack|kitchensink

${pc.bold('Headless setup (no prompts — agents/CI):')}
  vibekit init [dir] --yes --agents claude              Explicit agents; defaults: all skills, kapa+vibekit MCPs
  vibekit new <dir> -t contracts --yes --agents claude  Scaffold + agent setup
  Flags: --agents <csv> (required with --yes)  --skills all|none|<csv>  --mcps none|<csv>  --overwrite  --no-init (new only)
  Any flag pre-answers its wizard step; --yes fills the rest with defaults and skips confirms.
  Existing AGENTS.md/template files are kept in headless runs unless --overwrite.

${pc.bold('Accounts:')}
  Keys live in the OS keystore behind the keystore daemon (managed install, no global needed):
    vibekit keystore start|stop|status   The signing daemon, in the background (explore and mcp start it too)
    vibekit keystore serve      The daemon in this terminal (foreground)
    vibekit keystore accounts   List signing accounts: address, name, key id (daemon required)
    vibekit keystore generate ed25519 --name <label>   Create an account (via the daemon when it is up)
    vibekit keystore remove <address|name|key-id>   Destroy a key (confirms; --yes to skip)
    vibekit keystore list       List raw keys (or ask your agent: list_signing_addresses)
    Agents can create accounts too (create_signing_account); mnemonic/seed flows: vibekit keystore generate seed

${pc.bold('Environment:')}
  NETWORK, NETWORKS           Default network and the networks served by tool/mcp (localnet,testnet,mainnet)
  SIGNING=compose             tool/mcp: never connect a signer; return unsigned groups
  VIBEKIT_AGENT_MODEL         Explorer model id; with VIBEKIT_AGENT_PROVIDER, _BASE_URL, _API_KEY it overrides
                              the stored setup (vibekit explore setup)
  ANTHROPIC_API_KEY, OPENAI_API_KEY   Model provider keys; never stored in a file
  VIBEKIT_EXPLORE             Path to the Explorer TUI entry when not found beside this binary
  GITHUB_TOKEN                Optional, for catalog skill downloads when rate-limited
  XDG_CONFIG_HOME, XDG_DATA_HOME      Where config.json / localnet files and the managed keystore CLI live

${pc.bold('Links:')}
  Documentation:  ${teal('https://github.com/initlabsai/vibekit')}
`)
}

async function main(): Promise<boolean> {
  const [subcommand, ...args] = process.argv.slice(2)

  switch (subcommand) {
    case 'init': {
      const { commandInit } = await import('./commands/init.js')
      await commandInit(args)
      return true
    }
    case 'new': {
      const { commandNew } = await import('./commands/new.js')
      await commandNew(args)
      return true
    }
    case 'localnet': {
      const { commandLocalnet } = await import('./commands/localnet/index.js')
      await commandLocalnet(args)
      return true
    }
    case 'keystore': {
      const { commandKeystore } = await import('./commands/keystore.js')
      await commandKeystore(args)
      return true
    }
    case 'dispenser': {
      const { commandDispenser } = await import('./commands/dispenser.js')
      await commandDispenser(args)
      return true
    }
    case 'tool': {
      const { commandTool } = await import('./commands/tool.js')
      await commandTool(args)
      return true
    }
    case 'add': {
      const { commandAdd } = await import('./commands/add.js')
      await commandAdd(args)
      return true
    }
    case 'doctor': {
      const { commandDoctor } = await import('./commands/doctor.js')
      await commandDoctor(args)
      return true
    }
    case 'explore': {
      const { commandExplore } = await import('./commands/explore.js')
      await commandExplore(args)
      return true
    }
    case 'mcp': {
      if (args.includes('--help') || args.includes('-h')) {
        console.log(`vibekit mcp — VibeKit MCP server over stdio (spawned by agent harnesses).
Config via env: NETWORK (default localnet), NETWORKS (comma-separated), SIGNING=execute|compose`)
        return true
      }
      const { commandMcp } = await import('./commands/mcp.js')
      await commandMcp()
      return false // MCP server stays alive
    }
    case '--version':
    case '-v':
      console.log(`vibekit v${VERSION}`)
      return true
    case '--help':
    case '-h':
    case undefined:
      if (subcommand === undefined) console.log(amber(LOGO))
      showHelp()
      return true
    default:
      console.log(amber(LOGO))
      showHelp()
      console.error(pc.red(`Unknown command: ${subcommand}`))
      process.exitCode = 1
      return true
  }
}

main().then(async (shouldExit) => {
  // shouldExit is false only for the mcp server, whose stdio is protocol —
  // the update nudge must never reach it.
  if (shouldExit) {
    const { notifyIfOutdated } = await import('./update-check.js')
    await notifyIfOutdated().catch(() => {})
    process.exit(process.exitCode ?? 0)
  }
})
