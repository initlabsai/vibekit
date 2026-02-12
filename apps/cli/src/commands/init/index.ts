/**
 * Init command - interactive setup wizard
 */

import * as p from '@clack/prompts'
import pc from 'picocolors'
import { join } from 'path'

import { confirm } from '../../utils/prompts'
import { welcome, detectOSStep } from './phases/system'
import { checkDockerStep } from './phases/docker'
import { installAlgokitStep } from './phases/algokit'
import { setupProvidersStep } from './phases/providers'
import {
  selectToolStep,
  selectSkillsLocationStep,
  setupGithubPatStep,
  selectSkillsStep,
} from './phases/config'
import { selectMCPsStep } from './phases/mcps'
import { generateConfigsStep, setupSkillsStep, setupAgentsMdStep } from './phases/create'
import { authKappaStep, dispenserLoginStep } from './phases/auth'
import { showSummaryStep } from './phases/summary'
import type { SetupContext } from '../../types'
import {
  getEnabledAgents,
  getAgentConfigPath,
  getAgentSkillsDir,
  getAgentTemplateFile,
  requiresAccountProvider,
  requiresGithubPat,
  requiresDispenser,
  type AgentSelection,
  type MCPSelection,
} from '../../config'

/**
 * Confirm creating the project after preview
 * @returns true if confirmed, false if declined (helper exits on cancel)
 */
export async function confirmCreateProject(): Promise<boolean> {
  return confirm('Create project?', true)
}

/**
 * Build preview of files to be created
 */
function buildFilePreview(
  skillsPath: string,
  agents: AgentSelection,
  _mcps: MCPSelection,
  selectedSkillsCount: number
): string[] {
  const lines: string[] = []

  for (const agent of getEnabledAgents(agents)) {
    const configPath = getAgentConfigPath(skillsPath, agent)
    if (configPath) {
      lines.push(`  ${pc.dim(configPath)}`)
    }

    const skillsDir = getAgentSkillsDir(skillsPath, agent)
    if (skillsDir) {
      lines.push(`  ${pc.dim(skillsDir)} ${pc.cyan(`(${selectedSkillsCount} skills)`)}`)
    }

    const templatePath = getAgentTemplateFile(skillsPath, agent)
    if (templatePath) {
      lines.push(`  ${pc.dim(templatePath)}`)
    }
  }

  // Always show AGENTS.md (shared canonical source)
  lines.push(`  ${pc.dim(join(skillsPath, 'AGENTS.md'))}`)

  return lines
}

/**
 * Run the interactive setup wizard
 */
export async function runSetupWizard(): Promise<void> {
  // Phase 1: Welcome & OS detection
  welcome()
  const os = await detectOSStep()

  // Phase 2: AlgoKit check (common dependency)
  await installAlgokitStep(os)

  // Phase 3: AI tool selection
  const agents = await selectToolStep()

  // Phase 3.5: Skill selection
  const selectedSkills = await selectSkillsStep()

  // Phase 4: Directory selection
  const skillsPath = await selectSkillsLocationStep()

  // Phase 5: Docker check (for MCP availability display)
  const dockerResult = await checkDockerStep()

  // Phase 6: MCP selection
  const mcps = await selectMCPsStep(dockerResult.available)

  // Phase 7: GitHub PAT setup (conditional - only if any MCP requires it)
  let patResult: { configureGithub: boolean; pat?: string } = { configureGithub: false }
  if (requiresGithubPat(mcps)) {
    patResult = await setupGithubPatStep()
  }

  // Phase 8: Account provider selection (conditional - only if any MCP requires it)
  let vaultStatus: SetupContext['vaultStatus'] = 'skipped'
  let keyringStatus: SetupContext['keyringStatus'] = 'skipped'
  let walletConnectStatus: SetupContext['walletConnectStatus'] = 'skipped'
  if (requiresAccountProvider(mcps)) {
    const providerResult = await setupProvidersStep(dockerResult.available, dockerResult.running)
    vaultStatus = providerResult.vaultStatus
    keyringStatus = providerResult.keyringStatus
    walletConnectStatus = providerResult.walletConnectStatus
  }

  // Phase 9: Preview & Confirm
  const previewLines = buildFilePreview(skillsPath, agents, mcps, selectedSkills.length)
  p.note(previewLines.join('\n'), 'Files to create')

  const confirmed = await confirmCreateProject()
  if (!confirmed) {
    p.cancel('Setup cancelled.')
    process.exit(0)
  }

  // Build context
  const context: SetupContext = {
    os,
    agents,
    mcps,
    skillsPath,
    selectedSkills,
    githubPat: patResult.pat,
    configureGithub: patResult.configureGithub,
    dockerAvailable: dockerResult.available,
    dockerRunning: dockerResult.running,
    vaultStatus,
    keyringStatus,
    walletConnectStatus,
    kappaAuthStatus: 'skipped',
    dispenserAuthStatus: 'skipped',
  }

  // Phase 10: Create Files
  const s = p.spinner()
  s.start('Creating project files...')
  try {
    await generateConfigsStep(context)
    const skillsCount = await setupSkillsStep(agents, skillsPath, selectedSkills)
    s.stop(`Created ${skillsCount} skills`)

    // setupAgentsMdStep may prompt user, so run outside spinner
    await setupAgentsMdStep(agents, skillsPath)
  } catch (error) {
    s.stop('Failed to create project')
    throw error
  }

  // Phase 11: Auth Steps
  if (mcps.includes('kappa')) {
    context.kappaAuthStatus = await authKappaStep(agents, skillsPath)
  }
  if (requiresDispenser(mcps)) {
    context.dispenserAuthStatus = await dispenserLoginStep()
  }

  // Phase 12: Summary
  await showSummaryStep(context)
  p.outro(pc.green('The vibes are immaculate 😎'))
}

/**
 * Handle init command
 */
export async function commandInit(): Promise<void> {
  try {
    await runSetupWizard()
  } catch (error) {
    if (error instanceof Error) {
      p.log.error(`Setup failed: ${error.message}`)
    } else {
      p.log.error('Setup failed with an unexpected error')
    }
    process.exit(1)
  }
}
