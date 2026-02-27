/**
 * Create phase - generate configs, install skills, create agent files
 */

import * as p from '@clack/prompts'
import pc from 'picocolors'
import { dirname, join } from 'path'

import type { SetupContext, SkillsPath, SkillDirectory } from '../../../types'
import {
  MCP_ENV_VARS,
  getEnabledAgents,
  getAllAgentSkillsDirs,
  getSelectedMCPs,
  type AgentSelection,
  type AgentId,
} from '../../../config'
import { ensureDir, writeJsonFile, writeTextFile, fileExists } from '../../../utils/files'
import { writeTomlFile } from '../../../utils/toml'
import { saveGithubToken } from '../../../lib/vault'
import { getSkillsByNames, getSkillsCount, type SkillSelection } from '../../../lib/skills'
import { select } from '../../../utils/prompts'

import { agentsMdContent } from '../../../config/agents-md'

// --- Config Generation ---

function getVibekitPath(): string {
  const { basename, extname } = require('path')
  const name = basename(process.execPath, extname(process.execPath))

  if (name !== 'vibekit') {
    // Dev mode: point to the compiled binary in the CLI package
    return join(import.meta.dir, '..', '..', '..', '..', 'bin', 'vibekit')
  }

  return process.execPath
}

type TemplateVars = Record<string, () => unknown>

const TEMPLATE_VARS: TemplateVars = {
  $VIBEKIT_PATH: () => getVibekitPath(),
  $VIBEKIT_COMMAND_ARRAY: () => [getVibekitPath(), 'mcp'],
  $MCP_ENV: () => MCP_ENV_VARS,
}

function resolveTemplate(value: unknown): unknown {
  if (typeof value === 'string' && value in TEMPLATE_VARS) {
    return TEMPLATE_VARS[value]()
  }
  if (Array.isArray(value)) {
    return value.map(resolveTemplate)
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, resolveTemplate(v)]))
  }
  return value
}

/**
 * Deep clone an object
 */
function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj))
}

/**
 * Build the MCP config for an agent by merging base template with selected MCPs
 */
function buildAgentConfig(
  baseTemplate: Record<string, unknown>,
  mcpServersKey: string,
  agentId: AgentId,
  mcps: SetupContext['mcps']
): Record<string, unknown> {
  const config = deepClone(baseTemplate)
  const selectedMCPs = getSelectedMCPs(mcps)

  // Get or create the MCP servers section
  const serversSection = (config[mcpServersKey] as Record<string, unknown>) || {}

  // Add each selected MCP's config
  for (const mcp of selectedMCPs) {
    const mcpConfig = mcp.getAgentConfig(agentId)
    if (mcpConfig) {
      serversSection[mcpConfig.serverKey] = mcpConfig.config
    }
  }

  config[mcpServersKey] = serversSection
  return config
}

export async function generateConfigsStep(context: SetupContext): Promise<void> {
  if (context.githubPat) {
    saveGithubToken(context.githubPat)
  }

  for (const agent of getEnabledAgents(context.agents)) {
    if (!agent.baseConfigTemplate || !agent.configFile || !agent.mcpServersKey) continue

    // Build config by merging base template with selected MCPs
    const mergedConfig = buildAgentConfig(
      agent.baseConfigTemplate,
      agent.mcpServersKey,
      agent.id as AgentId,
      context.mcps
    )

    // Resolve template variables
    const config = resolveTemplate(mergedConfig)

    // Skip creating config file if no MCPs are configured
    const serversSection = (config as Record<string, unknown>)[agent.mcpServersKey] as
      | Record<string, unknown>
      | undefined
    if (!serversSection || Object.keys(serversSection).length === 0) {
      continue
    }

    const outputPath = join(context.skillsPath, agent.configFile)
    if (agent.configFormat === 'toml') {
      await writeTomlFile(outputPath, config as Record<string, unknown>)
    } else {
      await writeJsonFile(outputPath, config)
    }
  }
}

// --- Skills Installation ---

async function installSkillsToDir(targetDir: string, skills: SkillDirectory[]): Promise<void> {
  await ensureDir(targetDir)

  for (const skill of skills) {
    const skillDir = join(targetDir, skill.name)
    await ensureDir(skillDir)

    for (const file of skill.files) {
      // Handle nested paths (e.g., references/REFERENCE.md)
      const filePath = join(skillDir, file.path)
      const fileDir = dirname(filePath)
      if (fileDir !== skillDir) {
        await ensureDir(fileDir)
      }
      await writeTextFile(filePath, file.content)
    }
  }
}

export async function setupSkillsStep(
  agents: AgentSelection,
  skillsPath: SkillsPath,
  selectedSkills: SkillSelection
): Promise<number> {
  const skills = getSkillsByNames(selectedSkills)
  const targetDirs = getAllAgentSkillsDirs(skillsPath, agents)

  for (const targetDir of targetDirs) {
    await installSkillsToDir(targetDir, skills)
  }

  return getSkillsCount(skills)
}

// --- Agent Files (AGENTS.md etc.) ---

interface TemplateFile {
  path: string
  content: string
}

function getTemplatesToInstall(agents: AgentSelection): TemplateFile[] {
  const enabledAgents = getEnabledAgents(agents)
  const templates: TemplateFile[] = []

  // Always install AGENTS.md (shared canonical source)
  templates.push({ path: 'AGENTS.md', content: agentsMdContent })

  // Add agent-specific templates (content colocated with agent definitions)
  for (const agent of enabledAgents) {
    if (agent.templateFile && agent.templateContent) {
      templates.push({
        path: agent.templateFile,
        content: agent.templateContent,
      })
    }
  }

  return templates
}

export async function setupAgentsMdStep(
  agents: AgentSelection,
  skillsPath: SkillsPath
): Promise<void> {
  const templates = getTemplatesToInstall(agents)

  // Check which files already exist
  const existingFiles: string[] = []
  for (const template of templates) {
    const filePath = join(skillsPath, template.path)
    if (await fileExists(filePath)) {
      existingFiles.push(template.path)
    }
  }

  // If no existing files, write all and return
  if (existingFiles.length === 0) {
    for (const template of templates) {
      const filePath = join(skillsPath, template.path)
      // Ensure parent directory exists (for nested paths like .github/)
      await ensureDir(dirname(filePath))
      await writeTextFile(filePath, template.content)
    }
    return
  }

  // Warn and prompt for action
  p.log.warn(`Found existing files: ${existingFiles.map((f) => pc.cyan(f)).join(', ')}`)

  const action = await select({
    message: 'How would you like to handle existing files?',
    options: [
      { value: 'skip', label: 'Skip existing files', hint: 'keep your customizations' },
      { value: 'overwrite', label: 'Overwrite all', hint: 'replace with latest templates' },
    ],
  })

  // Write files based on user choice
  for (const template of templates) {
    const filePath = join(skillsPath, template.path)
    const exists = existingFiles.includes(template.path)

    if (exists && action === 'skip') {
      p.log.info(`Skipped ${pc.dim(template.path)}`)
      continue
    }

    // Ensure parent directory exists (for nested paths like .github/)
    await ensureDir(dirname(filePath))
    await writeTextFile(filePath, template.content)
  }
}
