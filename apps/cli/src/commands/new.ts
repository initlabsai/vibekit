/**
 * `vibekit new` — scaffold a project from a starter template.
 *
 * Fetches the template repo's tarball from GitHub (no git, no npm needed)
 * and extracts it into the target directory.
 */

import * as p from '@clack/prompts'
import pc from 'picocolors'
import { amber, teal } from '../brand.js'

import { LOGO } from '../logo.js'
import { existsSync } from 'fs'
import { readdir } from 'fs/promises'
import { basename } from 'path'

import { expandPath } from '../utils/paths.js'
import { extractTarball } from '../utils/tarball.js'
import { confirm, select, text } from '../utils/prompts.js'
import { parseInitArgs, runInitAt, type InitFlags } from './init.js'

export interface TemplateDefinition {
  id: string
  repo: string
  label: string
  hint: string
}

/** Three additive tiers, synced from the private algorand-starter-templates monorepo. */
export const TEMPLATES: TemplateDefinition[] = [
  {
    id: 'contracts',
    repo: 'initlabsai/algorand-starter-contracts',
    label: 'Contracts',
    hint: 'Smart contracts only (puya-ts + typed clients + tests)',
  },
  {
    id: 'fullstack',
    repo: 'initlabsai/algorand-starter-fullstack',
    label: 'Full-stack',
    hint: 'Contracts + React frontend with wallet integration',
  },
  {
    id: 'kitchensink',
    repo: 'initlabsai/algorand-starter-kitchensink',
    label: 'Kitchen sink',
    hint: 'Everything: contracts, frontend, subscriber, and extras',
  },
]

export function getTemplate(id: string): TemplateDefinition | undefined {
  return TEMPLATES.find((t) => t.id === id)
}

function welcome(): void {
  console.clear()
  console.log(amber(LOGO))
  p.note(
    [
      'A new Algorand project from a starter template.',
      '',
      `${pc.dim('•')} Fetches the template (no git or npm needed)`,
      `${pc.dim('•')} Optionally sets up your AI coding agents inside it`,
      `${pc.dim('•')} Leaves you one \`npm run build\` from a deployable contract`,
    ].join('\n'),
    'Welcome',
  )
}

export function tarballUrl(template: TemplateDefinition, ref = 'main'): string {
  return `https://codeload.github.com/${template.repo}/tar.gz/refs/heads/${ref}`
}

/** Directory is safe to scaffold into when it doesn't exist or is empty. */
async function isDirAvailable(dir: string): Promise<boolean> {
  if (!existsSync(dir)) return true
  const entries = await readdir(dir)
  return entries.length === 0
}

async function countFiles(dir: string): Promise<number> {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true })
  return entries.filter((entry) => entry.isFile()).length
}

interface NewArgs {
  dir?: string
  template?: string
  noInit: boolean
  /** Remaining flags (incl. dir and --yes) shared with `vibekit init`. */
  init: InitFlags
}

export function parseNewArgs(args: string[]): NewArgs {
  let template: string | undefined
  let noInit = false
  const rest: string[] = []
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!
    if (arg === '--template' || arg === '-t') template = args[++i]
    else if (arg === '--no-init') noInit = true
    else if (arg === '--global' || arg === '-g') {
      throw new Error('vibekit new always scaffolds a project; use `vibekit init --global` for user-scoped setup')
    } else rest.push(arg)
  }
  const init = parseInitArgs(rest)
  return { dir: init.dir, template, noInit, init }
}

export async function commandNew(args: string[]): Promise<void> {
  let parsed: NewArgs
  try {
    parsed = parseNewArgs(args)
  } catch (error) {
    p.log.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
  const headless = parsed.init.yes

  if (!headless) welcome()
  p.intro(teal('vibekit new'))

  if (parsed.template && !getTemplate(parsed.template)) {
    p.log.error(
      `Unknown template '${parsed.template}'. Available: ${TEMPLATES.map((t) => t.id).join(', ')}`,
    )
    process.exit(1)
  }
  if (headless && (!parsed.template || !parsed.dir)) {
    // Headless runs can't prompt for the missing pieces.
    p.log.error('--yes requires a project directory and --template <id>.')
    process.exit(1)
  }

  const templateId =
    parsed.template ??
    ((await select({
      message: 'Which template?',
      options: TEMPLATES.map((t) => ({
        value: t.id,
        label: t.label,
        hint: t.hint,
      })),
    })) as string)
  const template = getTemplate(templateId)!

  const dirInput =
    parsed.dir ??
    (await text({
      message: 'Project directory:',
      placeholder: `my-algorand-app`,
      validate: (value) => ((value ?? '').trim() === '' ? 'Directory is required' : undefined),
    }))
  // expandPath resolves too; resolve() first would defeat ~ expansion.
  const targetDir = expandPath(dirInput)

  if (!(await isDirAvailable(targetDir))) {
    p.log.error(`Directory ${teal(targetDir)} already exists and is not empty.`)
    process.exit(1)
  }

  const s = p.spinner()
  s.start(`Fetching ${template.repo}...`)
  try {
    await extractTarball(tarballUrl(template), targetDir)
    const fileCount = await countFiles(targetDir)
    s.stop(`Created ${teal(basename(targetDir))} (${fileCount} files)`)
  } catch (error) {
    s.stop('Failed to create project')
    p.log.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  }

  // Greenfield = scaffold + init composed: skills and MCP configs come from
  // the CLI (one source of truth), never baked into the template repos.
  if (parsed.noInit) {
    p.log.info('Skipped agent setup (--no-init) — run `vibekit init` inside the project any time.')
  } else if (headless || (await confirm('Set up AI coding agents in this project?', true))) {
    await runInitAt(targetDir, { ...parsed.init, scope: 'project' })
  } else {
    p.log.info('Skipped — run `vibekit init` inside the project any time.')
  }

  p.note(
    [
      `${teal('cd')} ${dirInput}`,
      `${teal('npm install')}`,
      `${teal('vibekit localnet start')}`,
      `${teal('npm run build')}`,
    ].join('\n'),
    'Next steps',
  )
  p.outro(teal('Project ready.'))
}
