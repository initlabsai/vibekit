/**
 * AlgoKit installation phase
 */

import * as p from '@clack/prompts'
import pc from 'picocolors'
import { commandExists, getCommandOutput, runCommand } from '../../../utils/shell'
import { withSpinner } from '../../../utils/spinner'
import type { OS } from '../../../types'
import { URLS } from '../../../config'
import { confirm } from '../../../utils/prompts'

async function confirmInstallAlgokit(): Promise<boolean> {
  return confirm('Install AlgoKit now?', true)
}

async function checkAlgoKit(): Promise<string | null> {
  if (await commandExists('algokit')) {
    return await getCommandOutput('algokit', ['--version'])
  }
  return null
}

async function installMacOS(): Promise<void> {
  if (!(await commandExists('brew'))) {
    p.log.error('Homebrew is required to install AlgoKit on macOS.')
    p.note(
      [
        'Install Homebrew first:',
        pc.cyan(`/bin/bash -c "$(curl -fsSL ${URLS.homebrewInstall})"`),
        '',
        'Then re-run VibeKit.',
      ].join('\n'),
      'Missing Prerequisite'
    )
    process.exit(1)
  }

  await withSpinner(
    {
      start: 'Installing AlgoKit via Homebrew...',
      success: 'AlgoKit installed',
      fail: 'AlgoKit installation failed',
    },
    async () => {
      const result = await runCommand('brew', ['install', 'algorandfoundation/tap/algokit'])
      if (!result.success) throw new Error('Homebrew install failed')
    }
  )
}

async function installLinux(): Promise<void> {
  if (!(await commandExists('pipx'))) {
    p.log.error('pipx is required to install AlgoKit on Linux.')
    p.note(
      [
        'Install prerequisites first:',
        `1. Python 3.12+: ${pc.cyan(URLS.pythonDownloads)}`,
        `2. pipx: ${pc.cyan(URLS.pipxDocs)}`,
        '',
        'Then re-run VibeKit.',
      ].join('\n'),
      'Missing Prerequisites'
    )
    process.exit(1)
  }

  await withSpinner(
    {
      start: 'Installing AlgoKit via pipx...',
      success: 'AlgoKit installed',
      fail: 'AlgoKit installation failed',
    },
    async () => {
      const result = await runCommand('pipx', ['install', 'algokit'])
      if (!result.success) throw new Error('pipx install failed')
    }
  )
}

async function installWindows(): Promise<void> {
  if (await commandExists('winget')) {
    await withSpinner(
      {
        start: 'Installing AlgoKit via winget...',
        success: 'AlgoKit installed',
        fail: 'AlgoKit installation failed',
      },
      async () => {
        const result = await runCommand('winget', ['install', '--id', 'AlgorandFoundation.AlgoKit', '-e'])
        if (!result.success) throw new Error('winget install failed')
      }
    )
  } else if (await commandExists('pipx')) {
    await withSpinner(
      {
        start: 'Installing AlgoKit via pipx...',
        success: 'AlgoKit installed',
        fail: 'AlgoKit installation failed',
      },
      async () => {
        const result = await runCommand('pipx', ['install', 'algokit'])
        if (!result.success) throw new Error('pipx install failed')
      }
    )
  } else {
    p.log.error('winget or pipx is required to install AlgoKit on Windows.')
    p.note(
      [
        'Install using one of:',
        `1. winget (included in modern Windows)`,
        `2. pipx`,
        '',
        'Then re-run VibeKit.',
      ].join('\n'),
      'Missing Prerequisites'
    )
    process.exit(1)
  }
}

export async function installAlgokitStep(os: OS): Promise<void> {
  const version = await checkAlgoKit()

  if (version) {
    p.log.success(`AlgoKit installed (${version})`)
    return
  }

  p.log.warn('AlgoKit CLI not found.')

  const shouldInstall = await confirmInstallAlgokit()
  if (!shouldInstall) {
    p.note(`Install manually: ${pc.cyan(URLS.algokitDocs)}`, 'Skipped')
    return
  }

  switch (os) {
    case 'macos':
      await installMacOS()
      break
    case 'linux':
      await installLinux()
      break
    case 'windows':
      await installWindows()
      break
  }
}
