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
  vibekit init                Set up AI coding agents (skills, MCP config)
  vibekit new [dir]           Scaffold a project from a starter template
  vibekit localnet <cmd>      Manage the local Algorand network (Docker)
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

${pc.bold('Accounts:')}
  Keys live in the OS keystore via the ${pc.cyan('keystore')} CLI (@algorandfoundation/keystore-node):
    keystore generate           Create an account
    keystore list               List accounts
    keystore serve              Start the signing daemon (required for execute mode)

${pc.bold('Links:')}
  Documentation:  ${pc.cyan('https://github.com/initlabsai/vibekit')}
`)
}

async function main(): Promise<boolean> {
  const [subcommand, ...args] = process.argv.slice(2)

  switch (subcommand) {
    case 'init': {
      const { commandInit } = await import('./commands/init.js')
      await commandInit()
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
    case 'mcp': {
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
