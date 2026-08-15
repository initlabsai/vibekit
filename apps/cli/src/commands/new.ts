/**
 * `vibekit new` — scaffold a project from a starter template.
 *
 * Fetches the template repo's tarball from GitHub (no git, no npm needed)
 * and extracts it into the target directory.
 */

import * as p from '@clack/prompts'
import pc from 'picocolors'
import { existsSync } from 'fs'
import { mkdir, readdir } from 'fs/promises'
import { basename, resolve } from 'path'

import { expandPath } from '../utils/paths.js'
import { select, text } from '../utils/prompts.js'

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
    hint: 'Everything: contracts, frontend, extra examples',
  },
]

export function getTemplate(id: string): TemplateDefinition | undefined {
  return TEMPLATES.find((t) => t.id === id)
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

async function extractTarball(url: string, targetDir: string): Promise<void> {
  const response = await fetch(url)
  if (!response.ok || !response.body) {
    throw new Error(`Failed to fetch template (${response.status}). Check your network connection.`)
  }

  await mkdir(targetDir, { recursive: true })

  // --strip-components=1 drops the "<repo>-<ref>/" wrapper directory
  const proc = Bun.spawn(['tar', '-xzf', '-', '--strip-components=1', '-C', targetDir], {
    stdin: response.body,
    stderr: 'pipe',
  })

  const exitCode = await proc.exited
  if (exitCode !== 0) {
    const stderr = await new Response(proc.stderr).text()
    throw new Error(`tar failed (exit ${exitCode}): ${stderr.trim()}`)
  }
}

async function countFiles(dir: string): Promise<number> {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true })
  return entries.filter((entry) => entry.isFile()).length
}

interface NewArgs {
  dir?: string
  template?: string
}

export function parseNewArgs(args: string[]): NewArgs {
  const result: NewArgs = {}
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!
    if (arg === '--template' || arg === '-t') {
      result.template = args[++i]
    } else if (!arg.startsWith('-') && result.dir === undefined) {
      result.dir = arg
    }
  }
  return result
}

export async function commandNew(args: string[]): Promise<void> {
  const parsed = parseNewArgs(args)

  p.intro(pc.cyan('vibekit new'))

  if (parsed.template && !getTemplate(parsed.template)) {
    p.log.error(
      `Unknown template '${parsed.template}'. Available: ${TEMPLATES.map((t) => t.id).join(', ')}`,
    )
    process.exit(1)
  }

  const templateId =
    parsed.template ??
    ((await select({
      message: 'Which template?',
      options: TEMPLATES.map((t) => ({ value: t.id, label: t.label, hint: t.hint })),
    })) as string)
  const template = getTemplate(templateId)!

  const dirInput =
    parsed.dir ??
    (await text({
      message: 'Project directory:',
      placeholder: `my-algorand-app`,
      validate: (value) => (value.trim() === '' ? 'Directory is required' : undefined),
    }))
  const targetDir = expandPath(resolve(dirInput))

  if (!(await isDirAvailable(targetDir))) {
    p.log.error(`Directory ${pc.cyan(targetDir)} already exists and is not empty.`)
    process.exit(1)
  }

  const s = p.spinner()
  s.start(`Fetching ${template.repo}...`)
  try {
    await extractTarball(tarballUrl(template), targetDir)
    const fileCount = await countFiles(targetDir)
    s.stop(`Created ${pc.cyan(basename(targetDir))} (${fileCount} files)`)
  } catch (error) {
    s.stop('Failed to create project')
    p.log.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  }

  p.note(
    [
      `${pc.cyan('cd')} ${dirInput}`,
      `${pc.cyan('npm install')}`,
      `${pc.cyan('vibekit localnet start')}`,
      `${pc.cyan('npm run build')}`,
      '',
      pc.dim('Run `vibekit init` inside the project to set up your AI agent.'),
    ].join('\n'),
    'Next steps',
  )
  p.outro(pc.green('Project ready.'))
}
