/**
 * Config phase - gather user configuration (tool, path, GitHub PAT)
 */

import * as p from '@clack/prompts'
import pc from 'picocolors'

import { text, password, confirm, select, multiselect } from '../../../utils/prompts'
import { expandPath } from '../../../utils/paths'
import { URLS } from '../../../config'
import { isValidGitHubPATFormat } from '../../../utils/validation'
import { hasGithubToken } from '../../../lib/vault'
import { AGENTS, AGENT_IDS, type AgentId } from '../../../config'
import { getSkillNames, type SkillSelection } from '../../../lib/skills'
import type { SkillsPath } from '../../../types'

function buildAgentOptions(): { value: AgentId; label: string }[] {
  return AGENT_IDS.map((id) => ({
    value: id,
    label: AGENTS[id].displayName,
  }))
}

export async function selectToolStep(): Promise<AgentId[]> {
  const options = buildAgentOptions()
  return multiselect({
    message: 'Which AI coding tools are you using?',
    options,
    required: true,
  })
}

export async function selectSkillsLocationStep(): Promise<SkillsPath> {
  const cwd = process.cwd()
  const inputPath = await text({
    message: 'Where should VibeKit be installed?',
    placeholder: cwd,
    defaultValue: cwd,
  })
  return expandPath(inputPath)
}

export interface GitHubPATResult {
  configureGithub: boolean
  pat?: string
}

async function promptForPatRaw(): Promise<string> {
  return password({
    message: 'Enter your GitHub PAT (or press Enter to skip):',
  })
}

async function confirmContinueWithPat(): Promise<boolean> {
  return confirm('Continue with this PAT anyway?', false)
}

async function promptConfigureGithub(): Promise<boolean> {
  return select({
    message: 'Would you like to configure GitHub integration?',
    options: [
      {
        value: true,
        label: 'Yes, configure GitHub integration',
        hint: 'strongly recommended',
      },
      {
        value: false,
        label: 'No, skip for now',
        hint: 'can configure later',
      },
    ],
  })
}

async function promptForPat(): Promise<string | undefined> {
  const pat = await promptForPatRaw()

  // Handle empty input (skip)
  if (!pat || pat.trim() === '') {
    p.log.warn('GitHub PAT skipped. You can add GITHUB_TOKEN to your MCP config later.')
    return undefined
  }

  if (!isValidGitHubPATFormat(pat)) {
    p.log.warn(`PAT doesn't match expected format (ghp_*, github_pat_*, or 40-char classic token)`)

    const continueAnyway = await confirmContinueWithPat()
    if (!continueAnyway) {
      return promptForPat()
    }
  } else {
    p.log.success('PAT format looks valid.')
  }

  return pat
}

export async function setupGithubPatStep(): Promise<GitHubPATResult> {
  if (hasGithubToken()) {
    const action = await select({
      message: 'GitHub PAT already configured. Keep existing token or replace it?',
      options: [
        { value: 'keep', label: 'Keep existing' },
        { value: 'replace', label: 'Replace with new token' },
      ],
    })

    if (action === 'keep') {
      p.log.success('Keeping existing GitHub PAT')
      return { configureGithub: true, pat: undefined }
    }

    // Fall through to promptForPat() below
    const pat = await promptForPat()
    return { configureGithub: true, pat }
  }

  const shouldConfigure = await promptConfigureGithub()

  if (!shouldConfigure) {
    p.note(
      [
        'You can configure GitHub integration later by adding GITHUB_TOKEN',
        'to the GITHUB_TOKEN environment variable in your MCP config.',
      ].join('\n'),
      'GitHub Integration Skipped'
    )

    return { configureGithub: false }
  }

  p.note(
    [
      'GitHub integration enables the AI to search Algorand repositories',
      'for canonical examples and patterns. This significantly improves',
      'code generation quality.',
      '',
      `Create a PAT at: ${pc.cyan(URLS.githubPatSettings)}`,
      '',
      `Required scopes: ${pc.yellow('repo')}, ${pc.yellow('read:org')}`,
      '',
      pc.dim('Note: Token must have an expiration date to work.'),
    ].join('\n'),
    'GitHub Personal Access Token'
  )

  const pat = await promptForPat()
  return { configureGithub: true, pat }
}

/**
 * Format skill name for display (e.g., "algorand-typescript" -> "Algorand TypeScript")
 */
function formatSkillName(name: string): string {
  return name
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

export async function selectSkillsStep(): Promise<SkillSelection> {
  const allSkillNames = getSkillNames()
  const skillCount = allSkillNames.length

  const selectionType = await select({
    message: 'Which skills would you like to install?',
    options: [
      {
        value: 'all',
        label: `All skills (${skillCount})`,
        hint: 'recommended',
      },
      {
        value: 'custom',
        label: 'Choose specific skills',
      },
    ],
  })

  if (selectionType === 'all') {
    return allSkillNames
  }

  // Custom selection
  const options = allSkillNames.map((name) => ({
    value: name,
    label: formatSkillName(name),
  }))

  return multiselect({
    message: 'Select skills to install:',
    options,
    required: true,
  })
}
