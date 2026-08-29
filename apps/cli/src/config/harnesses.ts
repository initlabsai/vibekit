/** The supported AI coding tools ("harnesses") and where each keeps its config and skills. */

import { homedir } from 'os'
import { join } from 'path'

export type InstallScope = 'project' | 'global'

export interface HarnessDefinition {
  id: string
  displayName: string
  /** Output config file path relative to the install dir (e.g. '.mcp.json'). */
  configFile: string
  configFormat?: 'json' | 'toml'
  /** Base MCP config the selected MCPs are merged into. */
  baseConfigTemplate: Record<string, unknown>
  /** Key used for MCP servers in this agent's config. */
  mcpServersKey: string
  /** Skills directory relative to the install dir; absent = agent has no skills dir. */
  skillsDir?: string
  /**
   * User-scoped MCP config as a path under home (`~/.…`), or `'vscode-user-mcp'`
   * for VS Code's profile `mcp.json`. Absent = this harness has no global MCP path.
   */
  globalConfigFile?: string | 'vscode-user-mcp'
  /** User-scoped skills directory under home (`~/.…`). Absent = no global skills. */
  globalSkillsDir?: string
  /** Agent-specific pointer file (e.g. 'CLAUDE.md') and its content. */
  templateFile?: string
  templateContent?: string
  /** User-scoped instructions file under home (`~/.…`). */
  globalTemplateFile?: string
  globalTemplateContent?: string
  /** Instructions for authenticating the Kapa MCP in this agent. */
  authInstructions?: string
  /** One-time setup the user must do for this agent (shown in the summary). */
  setupNote?: string
  /** CLI command to launch the agent after setup. */
  cliCommand?: string
}

const pointerContent = (
  relativeAgentsMd = './AGENTS.md',
) => `All agents should read \`AGENTS.md\` as the canonical source for project guidance.

See [AGENTS.md](${relativeAgentsMd}) for:

- Available skills and when to use them
- MCP tools for documentation, network queries, and transactions
- Development workflows for Algorand smart contracts
`

/** Global CLAUDE.md — skills/MCP apply everywhere; prefer a project's AGENTS.md when present. */
const globalClaudeContent = `# CLAUDE.md

VibeKit skills and MCP servers are installed for every project on this machine.

- Load \`use-vibekit\` before any on-chain action (accounts, LocalNet, signing, deploys).
- Load \`build-on-algorand\` for PuyaTs contracts, clients, tests, and wallets.
- Use the **vibekit** MCP for on-chain reads/writes; use **kapa** (or **context7**) for docs.
- When a project has \`AGENTS.md\`, treat it as the project-specific source of truth.
`

export const HARNESSES = {
  claude: {
    id: 'claude',
    displayName: 'Claude Code',
    configFile: '.mcp.json',
    baseConfigTemplate: { mcpServers: {} },
    mcpServersKey: 'mcpServers',
    skillsDir: '.claude/skills',
    // User-scope MCP lives in ~/.claude.json (top-level mcpServers), not under ~/.claude/.
    globalConfigFile: '~/.claude.json',
    globalSkillsDir: '~/.claude/skills',
    templateFile: 'CLAUDE.md',
    templateContent: `# CLAUDE.md\n\n${pointerContent()}`,
    globalTemplateFile: '~/.claude/CLAUDE.md',
    globalTemplateContent: globalClaudeContent,
    authInstructions: 'In Claude Code: /mcp → kapa → Authenticate',
    cliCommand: 'claude',
  },
  codex: {
    id: 'codex',
    displayName: 'Codex',
    configFile: '.codex/config.toml',
    configFormat: 'toml',
    baseConfigTemplate: { mcp_servers: {} },
    mcpServersKey: 'mcp_servers',
    skillsDir: '.agents/skills',
    globalConfigFile: '~/.codex/config.toml',
    globalSkillsDir: '~/.agents/skills',
    // Codex natively reads AGENTS.md — no separate pointer file needed
    authInstructions: 'In Codex: /mcp → kapa → Authenticate',
    cliCommand: 'codex',
  },
  copilot: {
    id: 'copilot',
    displayName: 'VS Code Copilot [EXPERIMENTAL]',
    configFile: '.vscode/mcp.json',
    baseConfigTemplate: { servers: {} },
    mcpServersKey: 'servers',
    skillsDir: '.github/skills',
    globalConfigFile: 'vscode-user-mcp',
    globalSkillsDir: '~/.copilot/skills',
    templateFile: '.github/copilot-instructions.md',
    templateContent: `# copilot-instructions.md\n\n${pointerContent('../AGENTS.md')}`,
    authInstructions: 'In VS Code: Open .vscode/mcp.json → Click "Start" above kapa',
  },
  cursor: {
    id: 'cursor',
    displayName: 'Cursor',
    configFile: '.cursor/mcp.json',
    baseConfigTemplate: { mcpServers: {} },
    mcpServersKey: 'mcpServers',
    // Project init historically used .cursor/rules; Cursor Agent Skills use .cursor/skills.
    skillsDir: '.cursor/rules',
    globalConfigFile: '~/.cursor/mcp.json',
    globalSkillsDir: '~/.cursor/skills',
    templateFile: '.cursorrules',
    templateContent: `# .cursorrules\n\n${pointerContent()}`,
    authInstructions: 'In Cursor Settings → MCP → kapa → Authenticate',
    cliCommand: 'cursor',
  },
  grok: {
    id: 'grok',
    displayName: 'Grok Build',
    // Native project TOML (highest precedence, committable). Grok can also
    // read .mcp.json, but that stops loading once the user imports or
    // dismisses its Claude-import prompt — too fragile to rely on.
    configFile: '.grok/config.toml',
    configFormat: 'toml',
    baseConfigTemplate: { mcp_servers: {} },
    mcpServersKey: 'mcp_servers',
    skillsDir: '.grok/skills',
    globalConfigFile: '~/.grok/config.toml',
    globalSkillsDir: '~/.grok/skills',
    // Grok reads AGENTS.md natively — no pointer file.
    authInstructions: 'In Grok Build: /mcps → kapa (Grok handles the OAuth flow directly)',
    cliCommand: 'grok',
  },
  pi: {
    id: 'pi',
    displayName: 'Pi',
    // pi-mcp-adapter reads the standard project .mcp.json (same file and
    // format Claude Code uses); pi reads AGENTS.md natively — no pointer file.
    configFile: '.mcp.json',
    baseConfigTemplate: { mcpServers: {} },
    mcpServersKey: 'mcpServers',
    skillsDir: '.pi/skills',
    globalConfigFile: '~/.pi/agent/mcp.json',
    globalSkillsDir: '~/.pi/agent/skills',
    authInstructions:
      'In pi: /mcp-auth kapa (first time; lazy servers show "not cached" until first use)',
    setupNote: 'Pi needs the MCP adapter once: pi install npm:pi-mcp-adapter',
    cliCommand: 'pi',
  },
  opencode: {
    id: 'opencode',
    displayName: 'OpenCode',
    configFile: 'opencode.json',
    baseConfigTemplate: { $schema: 'https://opencode.ai/config.json', mcp: {} },
    mcpServersKey: 'mcp',
    skillsDir: '.opencode/skill',
    globalConfigFile: '~/.config/opencode/opencode.json',
    globalSkillsDir: '~/.config/opencode/skills',
    authInstructions: 'Run: opencode mcp auth kapa',
    cliCommand: 'opencode',
  },
} as const satisfies Record<string, HarnessDefinition>

export type HarnessId = keyof typeof HARNESSES
export const HARNESS_IDS = Object.keys(HARNESSES) as HarnessId[]
export type HarnessSelection = HarnessId[]

/** Resolved on-disk paths for one harness at a given install scope. */
export interface HarnessInstallPaths {
  configFile: string
  skillsDir?: string
  templateFile?: string
  templateContent?: string
}

/** Expand a leading `~` against an explicit home (tests pass a temp home). */
export function expandHomePath(inputPath: string, home: string): string {
  if (inputPath === '~') return home
  if (inputPath.startsWith('~/') || inputPath.startsWith('~\\')) {
    return join(home, inputPath.slice(2))
  }
  return inputPath
}

/** VS Code profile mcp.json — path varies by OS; nests under `home` when overridden. */
export function vscodeUserMcpPath(home: string = homedir()): string {
  if (process.platform === 'darwin') {
    return join(home, 'Library', 'Application Support', 'Code', 'User', 'mcp.json')
  }
  if (process.platform === 'win32') {
    const appData =
      home === homedir() && process.env.APPDATA
        ? process.env.APPDATA
        : join(home, 'AppData', 'Roaming')
    return join(appData, 'Code', 'User', 'mcp.json')
  }
  const xdg = home === homedir() && process.env.XDG_CONFIG_HOME
    ? process.env.XDG_CONFIG_HOME
    : join(home, '.config')
  return join(xdg, 'Code', 'User', 'mcp.json')
}

export function enabledHarnesses(selected: HarnessSelection): HarnessDefinition[] {
  return selected.map((id) => HARNESSES[id])
}

export function resolveHarnessInstallPaths(
  agent: HarnessDefinition,
  scope: InstallScope,
  projectRoot: string,
  home: string = homedir(),
): HarnessInstallPaths {
  if (scope === 'project') {
    return {
      configFile: join(projectRoot, agent.configFile),
      skillsDir: agent.skillsDir ? join(projectRoot, agent.skillsDir) : undefined,
      templateFile: agent.templateFile ? join(projectRoot, agent.templateFile) : undefined,
      templateContent: agent.templateContent,
    }
  }

  let configFile: string | undefined
  if (agent.globalConfigFile === 'vscode-user-mcp') {
    configFile = vscodeUserMcpPath(home)
  } else if (agent.globalConfigFile) {
    configFile = expandHomePath(agent.globalConfigFile, home)
  }

  return {
    configFile: configFile ?? join(projectRoot, agent.configFile),
    skillsDir: agent.globalSkillsDir
      ? expandHomePath(agent.globalSkillsDir, home)
      : undefined,
    templateFile: agent.globalTemplateFile
      ? expandHomePath(agent.globalTemplateFile, home)
      : undefined,
    templateContent: agent.globalTemplateContent,
  }
}

export function getAgentSkillsDirs(
  basePath: string,
  selected: HarnessSelection,
  scope: InstallScope = 'project',
  home: string = homedir(),
): string[] {
  return enabledHarnesses(selected)
    .map((agent) => resolveHarnessInstallPaths(agent, scope, basePath, home).skillsDir)
    .filter((dir): dir is string => !!dir)
}
