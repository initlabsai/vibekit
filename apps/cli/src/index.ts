/**
 * vibekit — AI-assisted development environment for Algorand.
 */

import pc from 'picocolors'

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
  vibekit agent               Open the VibeKit Agent (web) — explore Algorand by conversation
  vibekit doctor              Diagnose setup problems (--fix repairs them)
  vibekit tool <name> [json]  Call any VibeKit tool from the shell (tool list to browse)
  vibekit dispenser <cmd>     TestNet dispenser session: login | status | logout
  vibekit keystore <args>     Managed keystore CLI (auto-provisioned, pinned — no global install)
  vibekit mcp                 Run the MCP server over stdio (for agent integration)

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
  vibekit init [dir] --yes --agents claude              Explicit agents; defaults: all skills, kappa+vibekit MCPs
  vibekit new <dir> -t contracts --yes --agents claude  Scaffold + agent setup
  Flags: --agents <csv> (required with --yes)  --skills all|none|<csv>  --mcps none|<csv>  --overwrite  --no-init (new only)
  Any flag pre-answers its wizard step; --yes fills the rest with defaults and skips confirms.
  Existing AGENTS.md/template files are kept in headless runs unless --overwrite.

${pc.bold('Accounts:')}
  Keys live in the OS keystore behind the keystore daemon (managed install, no global needed):
    vibekit keystore serve      Start the signing daemon (required for execute mode)
    vibekit keystore list       List keys (or ask your agent: list_signing_addresses)
    Ask your agent to create accounts (create_signing_account); mnemonic/seed flows:
    vibekit keystore generate seed

${pc.bold('Links:')}
  Documentation:  ${pc.cyan('https://github.com/initlabsai/vibekit')}
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
    case 'agent': {
      const { commandAgent } = await import('./commands/agent.js')
      await commandAgent()
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
      if (subcommand === undefined) console.log(pc.cyan(LOGO))
      showHelp()
      return true
    default:
      console.log(pc.cyan(LOGO))
      showHelp()
      console.error(pc.red(`Unknown command: ${subcommand}`))
      process.exitCode = 1
      return true
  }
}

main().then((shouldExit) => {
  if (shouldExit) process.exit(process.exitCode ?? 0)
})
