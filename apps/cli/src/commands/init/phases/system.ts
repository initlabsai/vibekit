/**
 * System phase - welcome display and OS detection
 */

import * as p from '@clack/prompts'
import pc from 'picocolors'

import { select } from '../../../utils/prompts'
import type { OS } from '../../../types'

const LOGO = `
 ██    ██ ██ ██████  ███████ ██   ██ ██ ████████
 ██    ██ ██ ██   ██ ██      ██  ██  ██    ██
 ██    ██ ██ ██████  █████   █████   ██    ██
  ██  ██  ██ ██   ██ ██      ██  ██  ██    ██
   ████   ██ ██████  ███████ ██   ██ ██    ██
`

export function welcome(): void {
  console.clear()

  console.log(pc.cyan(LOGO))

  p.note(
    [
      'Deploy contracts. Manage assets. Query the chain. All through your favorite AI agent.',
      '',
      'This setup will:',
      `${pc.dim('•')} Install AlgoKit CLI (if needed)`,
      `${pc.dim('•')} Set up secure account management (Vault or Keyring)`,
      `${pc.dim('•')} Configure your AI coding tool (OpenCode/Claude)`,
      `${pc.dim('•')} Install skills and MCP server for Algorand development`,
      `${pc.dim('•')} Authenticate with the TestNet dispenser`,
    ].join('\n'),
    'Welcome'
  )
}

function detectOS(): OS | null {
  switch (process.platform) {
    case 'darwin':
      return 'macos'
    case 'linux':
      return 'linux'
    case 'win32':
      return 'windows'
    default:
      return null
  }
}

export async function detectOSStep(): Promise<OS> {
  const detected = detectOS()

  if (detected) {
    return detected
  }

  // Manual selection for unknown platforms
  return select({
    message: 'Select your operating system:',
    options: [
      { value: 'macos' as const, label: 'macOS' },
      { value: 'linux' as const, label: 'Linux' },
      { value: 'windows' as const, label: 'Windows' },
    ],
  })
}
