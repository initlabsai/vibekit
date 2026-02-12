/**
 * VibeKit Type Definitions
 */

import type { AgentSelection, MCPSelection } from '../config'

/** Standardized status for simple steps that complete or skip */
export type StepStatus = 'completed' | 'skipped'

export type OS = 'macos' | 'linux'

/** Base path for skills and MCP config installation */
export type SkillsPath = string

/**
 * Status types for setup steps
 * - completed: Step finished successfully
 * - skipped: User chose to skip
 * - pending: Initial state before step runs
 * - error: Step failed with an error
 * - no-docker: Docker not available (Vault-specific)
 * - unavailable: Provider not available on this system
 */
export type VaultSetupStatus = 'completed' | 'skipped' | 'no-docker' | 'error' | 'pending'
export type KeyringSetupStatus = 'completed' | 'skipped' | 'unavailable' | 'error' | 'pending'
export type WalletConnectSetupStatus = 'completed' | 'skipped' | 'error' | 'pending'

export interface SetupContext {
  os: OS
  agents: AgentSelection
  mcps: MCPSelection
  skillsPath: SkillsPath
  selectedSkills: string[]
  githubPat?: string
  configureGithub: boolean
  dockerAvailable: boolean
  dockerRunning: boolean
  vaultStatus: VaultSetupStatus
  keyringStatus: KeyringSetupStatus
  walletConnectStatus: WalletConnectSetupStatus
  kappaAuthStatus: StepStatus
  dispenserAuthStatus: StepStatus
}

/**
 * Skill file content for bundling
 */
export interface SkillFile {
  path: string
  content: string
}

export interface SkillDirectory {
  name: string
  files: SkillFile[]
}
