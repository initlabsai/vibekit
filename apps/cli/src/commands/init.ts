/**
 * `vibekit init` — interactive setup wizard for AI coding agents.
 *
 * Ported from v1 apps/cli and slimmed: no Vault/keyring/WalletConnect providers
 * (keys live in the keystore daemon), no GitHub PAT, no dispenser auth, no
 * AlgoKit install (localnet is `vibekit localnet` now).
 */

import * as p from '@clack/prompts'
import pc from 'picocolors'
import { basename, dirname, extname, join } from 'path'
import { readFileSync } from 'fs'

import {
  AGENTS,
  AGENT_IDS,
  getEnabledAgents,
  getAgentSkillsDirs,
  type AgentId,
  type AgentSelection,
} from '../config/agents.js'
import {
  getMCPsByCategory,
  getSelectedMCPs,
  MCP_ENV,
  MCP_IDS,
  type MCPId,
  type MCPSelection,
} from '../config/mcps.js'
import { agentsMdContent } from '../config/agents-md.js'
import { LEGACY_SERVER_KEY } from './doctor.js'
import { getSkillNames, getSkillsByNames, type SkillSelection } from '../skills/index.js'
import { ensureDir, fileExists, writeJsonFile, writeTextFile } from '../utils/files.js'
import { writeTomlFile } from '../utils/toml.js'
import { expandPath } from '../utils/paths.js'
import { confirm, multiselect, select, text } from '../utils/prompts.js'
import { LOGO } from '../logo.js'

export interface SetupContext {
  agents: AgentSelection
  mcps: MCPSelection
  installPath: string
  selectedSkills: SkillSelection
}

// --- Headless flags ---

/**
 * Flags that pre-answer wizard steps. Any provided flag skips its prompt;
 * `--yes` skips every remaining prompt and confirm, taking vibekit's own
 * defaults for skills (all) and MCPs (kappa,vibekit) — but `--agents` must be
 * explicit: which coding tools you use is your fact, not our guess. Existing
 * files are kept unless --overwrite. This is the headless path agents/CI use.
 */
export interface InitFlags {
  dir?: string
  agents?: AgentSelection
  skills?: SkillSelection
  mcps?: MCPSelection
  yes: boolean
  overwrite: boolean
}

const HEADLESS_DEFAULT_MCPS: MCPSelection = ['kappa', 'vibekit']

function parseCsv(value: string | undefined, flag: string): string[] {
  if (!value || value.startsWith('-')) {
    throw new Error(`${flag} requires a comma-separated value`)
  }
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
}

function assertKnown(values: string[], known: readonly string[], flag: string): void {
  const unknown = values.filter((value) => !known.includes(value))
  if (unknown.length > 0) {
    throw new Error(`${flag}: unknown value(s) ${unknown.join(', ')}. Available: ${known.join(', ')}`)
  }
}

export function parseInitArgs(args: string[]): InitFlags {
  const flags: InitFlags = { yes: false, overwrite: false }
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!
    if (arg === '--yes' || arg === '-y') flags.yes = true
    else if (arg === '--overwrite') flags.overwrite = true
    else if (arg === '--agents') {
      const values = parseCsv(args[++i], '--agents')
      assertKnown(values, AGENT_IDS, '--agents')
      flags.agents = values as AgentSelection
    } else if (arg === '--skills') {
      const value = args[++i]
      if (value === 'all') flags.skills = getSkillNames()
      else if (value === 'none') flags.skills = []
      else {
        const values = parseCsv(value, '--skills')
        assertKnown(values, getSkillNames(), '--skills')
        flags.skills = values
      }
    } else if (arg === '--mcps') {
      const value = args[++i]
      if (value === 'none') flags.mcps = []
      else {
        const values = parseCsv(value, '--mcps')
        assertKnown(values, MCP_IDS, '--mcps')
        flags.mcps = values as MCPSelection
      }
    } else if (!arg.startsWith('-') && flags.dir === undefined) {
      flags.dir = arg
    } else {
      throw new Error(`Unknown argument: ${arg}`)
    }
  }
  if (flags.yes && !flags.agents) {
    throw new Error(`--yes requires --agents <csv> (available: ${AGENT_IDS.join(', ')})`)
  }
  return flags
}

// --- Prompt steps ---

function welcome(): void {
  console.clear()
  console.log(pc.cyan(LOGO))
  p.note(
    [
      'Deploy contracts. Manage assets. Query the chain. All through your favorite AI agent.',
      '',
      'This setup will:',
      `${pc.dim('•')} Configure your AI coding tools (Claude Code, Cursor, ...)`,
      `${pc.dim('•')} Install Algorand development skills`,
      `${pc.dim('•')} Configure MCP servers for docs and on-chain interaction`,
    ].join('\n'),
    'Welcome',
  )
}

async function selectAgentsStep(): Promise<AgentSelection> {
  return multiselect({
    message: 'Which AI coding tools are you using?',
    options: AGENT_IDS.map((id) => ({ value: id, label: AGENTS[id].displayName })),
    required: true,
  })
}

function formatSkillName(name: string): string {
  return name
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

async function selectSkillsStep(): Promise<SkillSelection> {
  const allSkillNames = getSkillNames()

  const selectionType = await select({
    message: 'Which skills would you like to install?',
    options: [
      { value: 'all', label: `All skills (${allSkillNames.length})`, hint: 'recommended' },
      { value: 'custom', label: 'Choose specific skills' },
    ],
  })

  if (selectionType === 'all') {
    return allSkillNames
  }

  return multiselect({
    message: 'Select skills to install:',
    options: allSkillNames.map((name) => ({ value: name, label: formatSkillName(name) })),
    required: true,
  })
}

async function selectInstallPathStep(): Promise<string> {
  const cwd = process.cwd()
  const inputPath = await text({
    message: 'Where should VibeKit be installed?',
    placeholder: cwd,
    defaultValue: cwd,
  })
  return expandPath(inputPath)
}

async function selectMCPsStep(): Promise<MCPSelection> {
  const selected: MCPId[] = []

  for (const [category, label, initial] of [
    ['documentation', 'Documentation MCP:', 'kappa'],
    ['development', 'Development MCP:', 'vibekit'],
  ] as const) {
    const mcps = getMCPsByCategory(category)
    const choice = await select({
      message: label,
      options: [
        ...mcps.map((mcp) => ({
          value: mcp.id as MCPId,
          label: mcp.displayName,
          hint: mcp.description,
        })),
        { value: 'skip', label: pc.dim('Skip'), hint: 'Do not configure this MCP' },
      ],
      initialValue: initial as MCPId | 'skip',
    })
    if (choice !== 'skip') selected.push(choice as MCPId)
  }

  return selected
}

// --- Config generation ---

/**
 * Resolve the path agents should use to spawn `vibekit mcp`: the invoked
 * binary when running compiled, or this app's bin/vibekit in dev mode.
 * Exported for tests via the injectable variant below.
 */
export function resolveVibekitPath(
  argv1: string | undefined,
  execPath: string,
  devFallback: string,
): string {
  // bun-compiled binaries report the *embedded* entry as argv[1]
  // (/$bunfs/root/...) — never write that; the real on-disk binary is execPath.
  if (argv1?.startsWith('/$bunfs')) {
    return execPath
  }
  if (argv1 && basename(argv1, extname(argv1)) === 'vibekit') {
    return argv1
  }
  return devFallback
}

function getVibekitPath(): string {
  return resolveVibekitPath(
    process.argv[1],
    process.execPath,
    join(import.meta.dir, '..', '..', 'bin', 'vibekit'),
  )
}

const TEMPLATE_VARS: Record<string, () => unknown> = {
  $VIBEKIT_PATH: () => getVibekitPath(),
  $VIBEKIT_COMMAND_ARRAY: () => [getVibekitPath(), 'mcp'],
  $MCP_ENV: () => MCP_ENV,
}

function resolveTemplate(value: unknown): unknown {
  if (typeof value === 'string' && value in TEMPLATE_VARS) {
    return TEMPLATE_VARS[value]!()
  }
  if (Array.isArray(value)) {
    return value.map(resolveTemplate)
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, resolveTemplate(v)]))
  }
  return value
}

export async function generateConfigs(context: SetupContext): Promise<void> {
  for (const agent of getEnabledAgents(context.agents)) {
    const outputPath = join(context.installPath, agent.configFile)

    // Merge into an existing JSON config: foreign MCP servers survive, and
    // v1's 'vibekit-mcp' entry is migrated out. (TOML configs are rewritten
    // wholesale — we don't parse TOML.)
    let config = structuredClone(agent.baseConfigTemplate) as Record<string, unknown>
    if (agent.configFormat !== 'toml' && fileExists(outputPath)) {
      try {
        config = JSON.parse(readFileSync(outputPath, 'utf-8')) as Record<string, unknown>
      } catch {
        // unparseable existing config: fall back to the fresh template
      }
    }
    const serversSection = (config[agent.mcpServersKey] as Record<string, unknown>) ?? {}
    delete serversSection[LEGACY_SERVER_KEY]

    for (const mcp of getSelectedMCPs(context.mcps)) {
      const agentConfig = mcp.getAgentConfig(agent.id as AgentId)
      if (agentConfig) {
        serversSection[agentConfig.serverKey] = agentConfig.config
      }
    }

    if (Object.keys(serversSection).length === 0) continue
    config[agent.mcpServersKey] = serversSection

    const resolved = resolveTemplate(config) as Record<string, unknown>
    if (agent.configFormat === 'toml') {
      await writeTomlFile(outputPath, resolved)
    } else {
      await writeJsonFile(outputPath, resolved)
    }
  }
}

async function installSkills(context: SetupContext): Promise<number> {
  const skills = getSkillsByNames(context.selectedSkills)

  for (const targetDir of getAgentSkillsDirs(context.installPath, context.agents)) {
    for (const skill of skills) {
      for (const file of skill.files) {
        await writeTextFile(join(targetDir, skill.name, file.path), file.content)
      }
    }
  }

  return skills.length
}

interface TemplateFile {
  path: string
  content: string
}

async function installAgentFiles(context: SetupContext, flags?: InitFlags): Promise<void> {
  const templates: TemplateFile[] = [{ path: 'AGENTS.md', content: agentsMdContent }]
  for (const agent of getEnabledAgents(context.agents)) {
    if (agent.templateFile && agent.templateContent) {
      templates.push({ path: agent.templateFile, content: agent.templateContent })
    }
  }

  const existingFiles = templates
    .map((t) => t.path)
    .filter((path) => fileExists(join(context.installPath, path)))

  let action: 'skip' | 'overwrite' = 'overwrite'
  if (existingFiles.length > 0) {
    p.log.warn(`Found existing files: ${existingFiles.map((f) => pc.cyan(f)).join(', ')}`)
    if (flags?.yes) {
      // Headless: never destroy customizations unless --overwrite says so.
      action = flags.overwrite ? 'overwrite' : 'skip'
    } else {
      action = (await select({
        message: 'How would you like to handle existing files?',
        options: [
          { value: 'skip', label: 'Skip existing files', hint: 'keep your customizations' },
          { value: 'overwrite', label: 'Overwrite all', hint: 'replace with latest templates' },
        ],
      })) as 'skip' | 'overwrite'
    }
  }

  for (const template of templates) {
    const filePath = join(context.installPath, template.path)
    if (existingFiles.includes(template.path) && action === 'skip') {
      p.log.info(`Skipped ${pc.dim(template.path)}`)
      continue
    }
    await ensureDir(dirname(filePath))
    await writeTextFile(filePath, template.content)
  }
}

// --- Preview & summary ---

function buildFilePreview(context: SetupContext): string[] {
  const lines: string[] = []
  for (const agent of getEnabledAgents(context.agents)) {
    lines.push(`  ${pc.dim(join(context.installPath, agent.configFile))}`)
    if (agent.skillsDir) {
      lines.push(
        `  ${pc.dim(join(context.installPath, agent.skillsDir))} ${pc.cyan(`(${context.selectedSkills.length} skills)`)}`,
      )
    }
    if (agent.templateFile) {
      lines.push(`  ${pc.dim(join(context.installPath, agent.templateFile))}`)
    }
  }
  lines.push(`  ${pc.dim(join(context.installPath, 'AGENTS.md'))}`)
  return lines
}

function showSummary(context: SetupContext): void {
  const enabledAgents = getEnabledAgents(context.agents)
  const mcpNames = getSelectedMCPs(context.mcps).map((mcp) => mcp.displayName)

  const lines = [
    `${pc.bold('Configured:')}`,
    `  Agents:  ${pc.green(enabledAgents.map((a) => a.displayName).join(', '))}`,
    `  MCPs:    ${mcpNames.length > 0 ? pc.green(mcpNames.join(', ')) : pc.yellow('none')}`,
    `  Skills:  ${pc.green(String(context.selectedSkills.length))}`,
  ]

  lines.push('', `${pc.bold('Next Steps:')}`, `  ${pc.cyan('cd')} ${context.installPath}`)

  const commands = enabledAgents.map((a) => a.cliCommand).filter((cmd): cmd is string => !!cmd)
  if (commands.length > 0) {
    lines.push(
      `  ${pc.cyan(commands[0]!)}${commands.length > 1 ? ` (or ${commands.slice(1).join(', ')})` : ''}`,
    )
  }

  if (context.mcps.includes('vibekit')) {
    lines.push(
      '',
      `${pc.bold('For on-chain development:')}`,
      `  ${pc.cyan('vibekit localnet start')}   requires Docker`,
      `  ${pc.cyan('vibekit keystore serve')}   enables signing (daemon auto-provisioned, no global install)`,
    )
  }

  const setupNotes = enabledAgents.filter((a) => a.setupNote).map((a) => a.setupNote!)
  if (setupNotes.length > 0) {
    lines.push('', `${pc.bold('One-time agent setup:')}`)
    for (const note of setupNotes) lines.push(`  ${note}`)
  }

  const hasCopilot = enabledAgents.some((a) => a.id === 'copilot')
  if (hasCopilot) {
    lines.push('', `${pc.bold('VS Code Setup:')}`, `  Enable "Agent Skills" in Settings (search "agentskills")`)
  }

  p.note(lines.join('\n'), 'Setup Complete')
}

// --- Entry point ---

/**
 * The agent-setup flow at a known path — shared by `vibekit init` (standalone,
 * brownfield) and `vibekit new` (composed after scaffolding, greenfield).
 * Templates stay agent-agnostic; the CLI is the single source of truth for
 * skills and MCP configs.
 *
 * Flags pre-answer steps; `--yes` fills the rest with defaults and skips
 * confirms (headless — usable by agents/CI without a TTY).
 */
export async function runInitAt(installPath: string, flags?: InitFlags): Promise<void> {
  // Headless (--yes) guarantees agents is set — parseInitArgs enforces it.
  const agents = flags?.agents ?? (await selectAgentsStep())
  const selectedSkills = flags?.skills ?? (flags?.yes ? getSkillNames() : await selectSkillsStep())
  const mcps = flags?.mcps ?? (flags?.yes ? HEADLESS_DEFAULT_MCPS : await selectMCPsStep())

  const context: SetupContext = { agents, mcps, installPath, selectedSkills }

  p.note(buildFilePreview(context).join('\n'), 'Files to create')
  if (!flags?.yes && !(await confirm('Create project?', true))) {
    p.cancel('Setup cancelled.')
    process.exit(0)
  }

  const s = p.spinner()
  s.start('Creating project files...')
  try {
    await generateConfigs(context)
    const skillsCount = await installSkills(context)
    s.stop(`Created ${skillsCount} skills`)
    // may prompt about existing files, so runs outside the spinner
    await installAgentFiles(context, flags)
  } catch (error) {
    s.stop('Failed to create project')
    throw error
  }

  if (mcps.includes('kappa')) {
    for (const agent of getEnabledAgents(agents)) {
      if (agent.authInstructions) {
        p.note(agent.authInstructions, `${agent.displayName} Kappa Auth`)
      }
    }
  }

  showSummary(context)
}

export async function runSetupWizard(flags: InitFlags): Promise<void> {
  const headless = flags.yes
  if (!headless) welcome()
  const installPath = flags.dir
    ? expandPath(flags.dir)
    : headless
      ? process.cwd()
      : await selectInstallPathStep()
  await runInitAt(installPath, flags)
  p.outro(pc.green('The vibes are immaculate 😎'))
}

export async function commandInit(args: string[] = []): Promise<void> {
  try {
    await runSetupWizard(parseInitArgs(args))
  } catch (error) {
    p.log.error(error instanceof Error ? `Setup failed: ${error.message}` : 'Setup failed with an unexpected error')
    process.exit(1)
  }
}
