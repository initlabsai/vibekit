/**
 * `vibekit init` — interactive setup wizard: picks harnesses, skills, and MCP
 * servers, then writes each harness's config, skills, and AGENTS.md. Keys live
 * in the keystore daemon and localnet is `vibekit localnet`, so no provider,
 * PAT, or AlgoKit setup happens here.
 *
 * Default scope is the project directory. `--global` (or the interactive
 * "all projects" choice) writes each harness's user-scoped MCP config and
 * skills instead, so they apply across projects.
 */

import * as p from '@clack/prompts'
import pc from 'picocolors'
import { amber, teal } from '../brand.js'
import { dirname, join } from 'path'
import { existsSync, readFileSync } from 'fs'
import { homedir } from 'os'

import {
  HARNESSES,
  HARNESS_IDS,
  enabledHarnesses,
  getAgentSkillsDirs,
  resolveHarnessInstallPaths,
  type HarnessId,
  type HarnessSelection,
  type InstallScope,
} from '../config/harnesses.js'
import {
  getMCPsByCategory,
  getSelectedMCPs,
  MCP_ENV,
  MCP_IDS,
  type MCPId,
  type MCPSelection,
  LEGACY_SERVER_KEY,
} from '../config/mcps.js'
import { agentsMdContent } from '../config/agents-md.js'
import {
  getAllSkillNames,
  getSkillNames,
  getSkillsByNames,
  type SkillDirectory,
} from '../skills/index.js'
import { CATALOGS, fetchCatalogSkills, splitCatalogSelection } from '../skills/catalogs.js'
import { ensureDir, writeJsonFile, writeTextFile } from '../utils/files.js'
import { mergeTomlMcpServers, writeTomlFile } from '../utils/toml.js'
import { expandPath, resolveVibekitPath } from '../utils/paths.js'
import { confirm, handleCancel, multiselect, select, text } from '../utils/prompts.js'
import { LOGO } from '../logo.js'

export interface SetupContext {
  agents: HarnessSelection
  mcps: MCPSelection
  /** Project root for project scope; unused for path resolution when global. */
  installPath: string
  selectedSkills: string[]
  scope?: InstallScope
  /** Override home for tests; defaults to os.homedir(). */
  homeDir?: string
}

// --- Headless flags ---

/**
 * Flags that pre-answer wizard steps. Any provided flag skips its prompt;
 * `--yes` skips every remaining prompt and confirm, taking vibekit's own
 * defaults for skills (all) and MCPs (kapa,vibekit) — but `--agents` must be
 * explicit: which coding tools you use is your fact, not our guess. Existing
 * files are kept unless --overwrite. This is the headless path agents/CI use.
 */
export interface InitFlags {
  dir?: string
  agents?: HarnessSelection
  skills?: string[]
  mcps?: MCPSelection
  yes: boolean
  overwrite: boolean
  /**
   * Install scope. `--global` sets `'global'`; a project `dir` or `--yes`
   * without `--global` implies `'project'`. When unset, the wizard asks.
   */
  scope?: InstallScope
  /** Test-only override for the home directory used by global paths. */
  homeDir?: string
}

const HEADLESS_DEFAULT_MCPS: MCPSelection = ['kapa', 'vibekit']

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
    throw new Error(
      `${flag}: unknown value(s) ${unknown.join(', ')}. Available: ${known.join(', ')}`,
    )
  }
}

export function parseInitArgs(args: string[]): InitFlags {
  const flags: InitFlags = { yes: false, overwrite: false }
  let globalFlag = false
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!
    if (arg === '--yes' || arg === '-y') flags.yes = true
    else if (arg === '--overwrite') flags.overwrite = true
    else if (arg === '--global' || arg === '-g') globalFlag = true
    else if (arg === '--agents') {
      const values = parseCsv(args[++i], '--agents')
      assertKnown(values, HARNESS_IDS, '--agents')
      flags.agents = values as HarnessSelection
    } else if (arg === '--skills') {
      const value = args[++i]
      if (value === 'all') flags.skills = getAllSkillNames()
      else if (value === 'none') flags.skills = []
      else {
        const values = parseCsv(value, '--skills')
        assertKnown(values, getAllSkillNames(), '--skills')
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
    throw new Error(`--yes requires --agents <csv> (available: ${HARNESS_IDS.join(', ')})`)
  }
  if (globalFlag && flags.dir !== undefined) {
    throw new Error('--global cannot be combined with a project directory')
  }
  if (globalFlag) flags.scope = 'global'
  else if (flags.dir !== undefined || flags.yes) flags.scope = 'project'
  return flags
}

// --- Prompt steps ---

function welcome(): void {
  console.clear()
  console.log(amber(LOGO))
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

async function selectAgentsStep(): Promise<HarnessSelection> {
  return multiselect({
    message: 'Which AI coding tools are you using?',
    options: HARNESS_IDS.map((id) => ({ value: id, label: HARNESSES[id].displayName })),
    required: true,
  })
}

function formatSkillName(name: string): string {
  return name
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

/** Picker copy for bundled skills; a new skill without an entry falls back to its name. */
const OFFICIAL_SKILLS: Record<string, [label: string, hint: string]> = {
  'use-vibekit': ['Use VibeKit', 'CLI, MCP tools, LocalNet, accounts, deploys'],
  'build-on-algorand': ['Build on Algorand', 'PuyaTs contracts, clients, tests, wallets'],
  'audit-algorand': ['Audit Algorand', 'security reviews of contracts and LogicSigs'],
  'build-on-vibekit': ['Build on VibeKit', 'custom tools, plugins, deployments'],
  'update-skill': ['Update Skill', 'maintain these skills from the VibeKit repo'],
}

/** Official skills pre-checked; catalog skills opt-in. */
async function selectSkillsStep(): Promise<string[]> {
  const rank = (name: string) => Object.keys(OFFICIAL_SKILLS).indexOf(name) + 1 || Infinity
  const official = getSkillNames().sort((a, b) => rank(a) - rank(b))
  return handleCancel(
    await p.groupMultiselect({
      message: 'Select skills to install:',
      options: {
        'VibeKit (official)': official.map((name) => ({
          value: name,
          label: OFFICIAL_SKILLS[name]?.[0] ?? formatSkillName(name),
          hint: OFFICIAL_SKILLS[name]?.[1],
        })),
        ...Object.fromEntries(
          CATALOGS.map((catalog) => [
            catalog.label,
            catalog.skills.map((name) => ({
              value: `${catalog.id}/${name}`,
              label: formatSkillName(name),
            })),
          ]),
        ),
      },
      initialValues: official,
      required: true,
    }),
  )
}

async function selectScopeStep(): Promise<InstallScope> {
  return (await select({
    message: 'Install for this project only, or for all projects?',
    options: [
      {
        value: 'project',
        label: 'This project',
        hint: 'configs and skills in the project directory (committable)',
      },
      {
        value: 'global',
        label: 'All projects (global)',
        hint: 'user-scoped MCP + skills for every project on this machine',
      },
    ],
    initialValue: 'project',
  })) as InstallScope
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
    ['documentation', 'Documentation MCP:', 'kapa'],
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

/** The `vibekit` agents spawn for `mcp`: the compiled binary, or the from-source shim in dev. */
function getVibekitPath(): string {
  return resolveVibekitPath(
    process.argv[1],
    process.execPath,
    join(import.meta.dir, '..', '..', 'scripts', 'vibekit-dev'),
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

function homeOf(context: SetupContext): string {
  return context.homeDir ?? homedir()
}

function scopeOf(context: SetupContext): InstallScope {
  return context.scope ?? 'project'
}

export async function generateConfigs(context: SetupContext): Promise<void> {
  const home = homeOf(context)
  const scope = scopeOf(context)
  for (const agent of enabledHarnesses(context.agents)) {
    if (scope === 'global' && !agent.globalConfigFile) continue

    const { configFile: outputPath } = resolveHarnessInstallPaths(
      agent,
      scope,
      context.installPath,
      home,
    )

    // Merge into an existing JSON config: foreign MCP servers survive, and
    // v1's 'vibekit-mcp' entry is migrated out. Global TOML configs merge
    // surgically; project TOML is still rewritten wholesale (we don't parse TOML).
    let config = structuredClone(agent.baseConfigTemplate) as Record<string, unknown>
    const existingToml =
      agent.configFormat === 'toml' && existsSync(outputPath)
        ? readFileSync(outputPath, 'utf-8')
        : null

    if (agent.configFormat !== 'toml' && existsSync(outputPath)) {
      try {
        config = JSON.parse(readFileSync(outputPath, 'utf-8')) as Record<string, unknown>
      } catch {
        // unparseable existing config: fall back to the fresh template
      }
    }

    const serversSection = (config[agent.mcpServersKey] as Record<string, unknown>) ?? {}
    delete serversSection[LEGACY_SERVER_KEY]

    const writtenServers: Record<string, Record<string, unknown>> = {}
    for (const mcp of getSelectedMCPs(context.mcps)) {
      const agentConfig = mcp.getAgentConfig(agent.id as HarnessId)
      if (agentConfig) {
        serversSection[agentConfig.serverKey] = agentConfig.config
        writtenServers[agentConfig.serverKey] = agentConfig.config as Record<string, unknown>
      }
    }

    if (Object.keys(serversSection).length === 0 && Object.keys(writtenServers).length === 0) {
      continue
    }
    config[agent.mcpServersKey] = serversSection

    const resolved = resolveTemplate(config) as Record<string, unknown>
    if (agent.configFormat === 'toml') {
      const resolvedServers = (resolved[agent.mcpServersKey] ?? {}) as Record<
        string,
        Record<string, unknown>
      >
      // Global: merge mcp_servers into the existing user config. Project: same
      // merge when a file already exists so we do not wipe sibling TOML keys.
      if (existingToml !== null) {
        const merged = mergeTomlMcpServers(existingToml, resolvedServers, [
          ...Object.keys(resolvedServers),
          LEGACY_SERVER_KEY,
        ])
        await ensureDir(dirname(outputPath))
        await writeTextFile(outputPath, merged)
      } else {
        await writeTomlFile(outputPath, resolved)
      }
    } else {
      await writeJsonFile(outputPath, resolved)
    }
  }
}

/**
 * Fetch the selected catalog skills. A failed catalog degrades to a warning —
 * init never hard-blocks on the network; bundled skills still install.
 */
async function fetchRemoteSkills(selected: string[]): Promise<SkillDirectory[]> {
  const remoteSkills: SkillDirectory[] = []
  for (const { catalog, names } of splitCatalogSelection(selected)) {
    const s = p.spinner()
    s.start(`Fetching ${catalog.label} skills (${catalog.repo})...`)
    try {
      remoteSkills.push(...(await fetchCatalogSkills(catalog, names)))
      s.stop(`Fetched ${names.length} ${catalog.label} skill${names.length === 1 ? '' : 's'}`)
    } catch (error) {
      s.stop(`Skipped ${catalog.label} skills`)
      p.log.warn(
        `Could not fetch ${catalog.repo}: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }
  return remoteSkills
}

async function installSkills(
  context: SetupContext,
  remoteSkills: SkillDirectory[],
): Promise<number> {
  const skills = [...getSkillsByNames(context.selectedSkills), ...remoteSkills]
  const home = homeOf(context)

  for (const targetDir of getAgentSkillsDirs(
    context.installPath,
    context.agents,
    scopeOf(context),
    home,
  )) {
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
  const home = homeOf(context)
  const scope = scopeOf(context)
  const templates: TemplateFile[] = []

  if (scope === 'project') {
    templates.push({ path: join(context.installPath, 'AGENTS.md'), content: agentsMdContent })
  }

  for (const agent of enabledHarnesses(context.agents)) {
    const paths = resolveHarnessInstallPaths(agent, scope, context.installPath, home)
    if (paths.templateFile && paths.templateContent) {
      templates.push({ path: paths.templateFile, content: paths.templateContent })
    }
  }

  const existingFiles = templates.filter((t) => existsSync(t.path))

  let action: 'skip' | 'overwrite' = 'overwrite'
  if (existingFiles.length > 0) {
    p.log.warn(`Found existing files: ${existingFiles.map((f) => teal(f.path)).join(', ')}`)
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

  const existingPaths = new Set(existingFiles.map((f) => f.path))
  for (const template of templates) {
    if (existingPaths.has(template.path) && action === 'skip') {
      p.log.info(`Skipped ${pc.dim(template.path)}`)
      continue
    }
    await ensureDir(dirname(template.path))
    await writeTextFile(template.path, template.content)
  }
}

// --- Preview & summary ---

function buildFilePreview(context: SetupContext): string[] {
  const home = homeOf(context)
  const scope = scopeOf(context)
  const lines: string[] = []
  for (const agent of enabledHarnesses(context.agents)) {
    const paths = resolveHarnessInstallPaths(agent, scope, context.installPath, home)
    if (scope === 'global' && !agent.globalConfigFile && !agent.globalSkillsDir) {
      lines.push(`  ${pc.dim(agent.displayName)} ${amber('(no global paths — skipped)')}`)
      continue
    }
    if (agent.globalConfigFile || scope === 'project') {
      lines.push(`  ${pc.dim(paths.configFile)}`)
    }
    if (paths.skillsDir) {
      lines.push(
        `  ${pc.dim(paths.skillsDir)} ${teal(`(${context.selectedSkills.length} skills)`)}`,
      )
    }
    if (paths.templateFile) {
      lines.push(`  ${pc.dim(paths.templateFile)}`)
    }
  }
  if (scope === 'project') {
    lines.push(`  ${pc.dim(join(context.installPath, 'AGENTS.md'))}`)
  }
  return lines
}

function showSummary(context: SetupContext): void {
  const enabledAgents = enabledHarnesses(context.agents)
  const mcpNames = getSelectedMCPs(context.mcps).map((mcp) => mcp.displayName)
  const scope = scopeOf(context)

  const lines = [
    `${pc.bold('Configured:')}`,
    `  Scope:   ${teal(scope === 'global' ? 'global (all projects)' : 'this project')}`,
    `  Agents:  ${teal(enabledAgents.map((a) => a.displayName).join(', '))}`,
    `  MCPs:    ${mcpNames.length > 0 ? teal(mcpNames.join(', ')) : amber('none')}`,
    `  Skills:  ${teal(String(context.selectedSkills.length))}`,
  ]

  if (scope === 'project') {
    lines.push('', `${pc.bold('Next Steps:')}`, `  ${teal('cd')} ${context.installPath}`)
  } else {
    lines.push(
      '',
      `${pc.bold('Next Steps:')}`,
      `  Open any project in a configured agent — MCP and skills apply globally`,
    )
  }

  const commands = enabledAgents.map((a) => a.cliCommand).filter((cmd): cmd is string => !!cmd)
  if (commands.length > 0) {
    lines.push(
      `  ${teal(commands[0]!)}${commands.length > 1 ? ` (or ${commands.slice(1).join(', ')})` : ''}`,
    )
  }

  if (context.mcps.includes('vibekit')) {
    lines.push(
      '',
      `${pc.bold('For on-chain development:')}`,
      `  ${teal('vibekit localnet start')}   requires Docker`,
      `  ${teal('vibekit keystore start')}   signing daemon in the background (explore and mcp start it too)`,
    )
  }

  const setupNotes = enabledAgents.filter((a) => a.setupNote).map((a) => a.setupNote!)
  if (setupNotes.length > 0) {
    lines.push('', `${pc.bold('One-time agent setup:')}`)
    for (const note of setupNotes) lines.push(`  ${note}`)
  }

  const hasCopilot = enabledAgents.some((a) => a.id === 'copilot')
  if (hasCopilot) {
    lines.push(
      '',
      `${pc.bold('VS Code Setup:')}`,
      `  Enable "Agent Skills" in Settings (search "agentskills")`,
    )
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
  const selectedSkills =
    flags?.skills ?? (flags?.yes ? getAllSkillNames() : await selectSkillsStep())
  const mcps = flags?.mcps ?? (flags?.yes ? HEADLESS_DEFAULT_MCPS : await selectMCPsStep())
  const scope: InstallScope = flags?.scope ?? (await selectScopeStep())

  const context: SetupContext = {
    agents,
    mcps,
    installPath,
    selectedSkills,
    scope,
    homeDir: flags?.homeDir,
  }

  p.note(buildFilePreview(context).join('\n'), 'Files to create')
  if (
    !flags?.yes &&
    !(await confirm(scope === 'global' ? 'Apply global setup?' : 'Create project?', true))
  ) {
    p.cancel('Setup cancelled.')
    process.exit(0)
  }

  const remoteSkills = await fetchRemoteSkills(context.selectedSkills)

  const s = p.spinner()
  s.start(scope === 'global' ? 'Writing global agent files...' : 'Creating project files...')
  try {
    await generateConfigs(context)
    const skillsCount = await installSkills(context, remoteSkills)
    s.stop(`Created ${skillsCount} skills`)
    // may prompt about existing files, so runs outside the spinner
    await installAgentFiles(context, flags)
  } catch (error) {
    s.stop(scope === 'global' ? 'Failed to write global files' : 'Failed to create project')
    throw error
  }

  if (mcps.includes('kapa')) {
    for (const agent of enabledHarnesses(agents)) {
      if (agent.authInstructions) {
        p.note(agent.authInstructions, `${agent.displayName} Kapa Auth`)
      }
    }
  }

  showSummary(context)
}

export async function runSetupWizard(flags: InitFlags): Promise<void> {
  const headless = flags.yes
  if (!headless) welcome()

  let scope = flags.scope
  if (!scope && !headless) scope = await selectScopeStep()
  if (!scope) scope = 'project'

  const installPath =
    scope === 'global'
      ? process.cwd()
      : flags.dir
        ? expandPath(flags.dir)
        : headless
          ? process.cwd()
          : await selectInstallPathStep()

  await runInitAt(installPath, { ...flags, scope })
  p.outro(teal('The vibes are immaculate 😎'))
}

export async function commandInit(args: string[] = []): Promise<void> {
  try {
    await runSetupWizard(parseInitArgs(args))
  } catch (error) {
    p.log.error(
      error instanceof Error
        ? `Setup failed: ${error.message}`
        : 'Setup failed with an unexpected error',
    )
    process.exit(1)
  }
}
