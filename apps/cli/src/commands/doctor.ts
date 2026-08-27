/**
 * `vibekit doctor` — diagnose (and with --fix, repair) the things that
 * actually break setups in the wild: a leftover v1 binary shadowing v2 on
 * PATH, broken or legacy vibekit MCP entries in the project's .mcp.json,
 * and missing Docker / keystore prerequisites.
 */

import pc from 'picocolors'
import { homedir } from 'os'
import { basename, join } from 'path'
import { existsSync, readFileSync } from 'fs'
import { unlink, copyFile } from 'fs/promises'

import { MCP_ENV } from '../config/mcps.js'
import { isProvisioned, provisionKeystoreCli, KEYSTORE_NODE_VERSION } from './keystore.js'
import { writeJsonFile } from '../utils/files.js'

/** The previous release's (0.x, gabrielkuettel/vibekit) MCP server key. */
export const LEGACY_SERVER_KEY = 'vibekit-mcp'
/** v1-era env vars that mean nothing to the v2 server. */
const LEGACY_ENV_VARS = [
  'ALGORAND_NETWORK',
  'ALGORAND_ALGOD',
  'ALGORAND_TOKEN',
  'ALGORAND_KMD',
  'ALGORAND_KMD_TOKEN',
  'ALGORAND_INDEXER',
]

export interface McpIssue {
  code: 'legacy-key' | 'bunfs-path' | 'missing-binary' | 'legacy-env' | 'no-vibekit-entry'
  message: string
}

interface McpServerEntry {
  command?: string
  args?: string[]
  env?: Record<string, string>
  [key: string]: unknown
}

/** Diagnose the vibekit-related entries of a parsed .mcp.json. Pure. */
export function diagnoseMcpConfig(
  config: { mcpServers?: Record<string, McpServerEntry> },
  binaryExists: (path: string) => boolean = existsSync,
): McpIssue[] {
  const issues: McpIssue[] = []
  const servers = config.mcpServers ?? {}

  if (LEGACY_SERVER_KEY in servers) {
    issues.push({
      code: 'legacy-key',
      message: `legacy server entry '${LEGACY_SERVER_KEY}' present (this release uses 'vibekit')`,
    })
  }

  const entry = servers['vibekit'] ?? servers[LEGACY_SERVER_KEY]
  if (!entry) {
    if (issues.length === 0) {
      issues.push({ code: 'no-vibekit-entry', message: 'no vibekit MCP server configured' })
    }
    return issues
  }

  if (entry.command?.startsWith('/$bunfs')) {
    issues.push({
      code: 'bunfs-path',
      message: `command points into a compiled binary's virtual filesystem (${entry.command})`,
    })
  } else if (entry.command && !binaryExists(entry.command)) {
    issues.push({ code: 'missing-binary', message: `command not found on disk: ${entry.command}` })
  }

  const envKeys = Object.keys(entry.env ?? {})
  const legacy = envKeys.filter((key) => LEGACY_ENV_VARS.includes(key))
  if (legacy.length > 0) {
    issues.push({ code: 'legacy-env', message: `legacy (0.x) env vars set: ${legacy.join(', ')}` })
  }

  return issues
}

/**
 * Rewrite the vibekit entry to a known-good v2 shape (current binary + v2
 * env), dropping the legacy key. All other servers are preserved. Pure.
 */
export function fixMcpConfig(
  config: { mcpServers?: Record<string, McpServerEntry>; [key: string]: unknown },
  binaryPath: string,
): typeof config {
  const servers = { ...(config.mcpServers ?? {}) }
  delete servers[LEGACY_SERVER_KEY]
  servers['vibekit'] = { command: binaryPath, args: ['mcp'], env: { ...MCP_ENV } }
  return { ...config, mcpServers: servers }
}

// --- Binary checks ---

/** The real on-disk path of the running CLI (compiled) or the dev binary. */
function selfPath(): string {
  if (process.argv[1]?.startsWith('/$bunfs')) return process.execPath
  return join(import.meta.dir, '..', '..', 'bin', 'vibekit')
}

async function runHelp(binary: string): Promise<string> {
  try {
    const proc = Bun.spawn([binary, '--help'], { stdout: 'pipe', stderr: 'pipe' })
    const output = await new Response(proc.stdout).text()
    await proc.exited
    return output
  } catch {
    return ''
  }
}

/** Legacy-release fingerprint: 0.x help advertises vault/dispenser command trees. */
export function looksLikeV1(helpText: string): boolean {
  return helpText.includes('vault') && helpText.includes('dispenser')
}

// --- The command ---

const ok = (message: string) => console.log(`${pc.green('✓')} ${message}`)
const bad = (message: string) => console.log(`${pc.red('✗')} ${message}`)
const warn = (message: string) => console.log(`${pc.yellow('!')} ${message}`)

export async function commandDoctor(args: string[]): Promise<void> {
  const fix = args.includes('--fix')
  let problems = 0

  // 1. Binary on PATH
  const self = selfPath()
  const onPath = Bun.which('vibekit')
  if (!onPath) {
    warn(
      `vibekit is not on PATH (running from ${self}) — agent configs use absolute paths, so this is fine`,
    )
  } else if (looksLikeV1(await runHelp(onPath))) {
    problems++
    bad(
      `legacy vibekit found on PATH (the previous 0.x release, github.com/gabrielkuettel/vibekit): ${onPath}`,
    )
    if (fix && existsSync(self) && basename(self) === 'vibekit' && self !== onPath) {
      await unlink(onPath) // survives "text file busy" when a v1 process is live
      await copyFile(self, onPath)
      ok(`  replaced with this binary (${self})`)
      problems--
    } else {
      console.log(pc.dim(`  fix: vibekit doctor --fix (replaces it with this binary)`))
    }
  } else {
    ok(`vibekit on PATH: ${onPath}`)
  }

  // 2. Project MCP config
  const mcpPath = join(process.cwd(), '.mcp.json')
  if (!existsSync(mcpPath)) {
    warn(`no .mcp.json in this directory — run \`vibekit init\` to configure agents here`)
  } else {
    let config: { mcpServers?: Record<string, McpServerEntry> } = {}
    try {
      config = JSON.parse(readFileSync(mcpPath, 'utf-8')) as typeof config
    } catch {
      problems++
      bad(`.mcp.json is not valid JSON`)
    }
    const issues = diagnoseMcpConfig(config)
    if (issues.length === 0) {
      ok(`.mcp.json vibekit entry looks healthy`)
    } else if (issues.length === 1 && issues[0]!.code === 'no-vibekit-entry') {
      warn(`.mcp.json has no vibekit server — run \`vibekit init\` to add it`)
    } else {
      problems += issues.length
      for (const issue of issues) bad(`.mcp.json: ${issue.message}`)
      if (fix) {
        const binary = onPath && !looksLikeV1(await runHelp(onPath)) ? onPath : self
        await writeJsonFile(mcpPath, fixMcpConfig(config, binary))
        ok(`  rewrote the vibekit entry (command: ${binary}); other servers untouched`)
        problems -= issues.length
      } else {
        console.log(pc.dim(`  fix: vibekit doctor --fix`))
      }
    }
  }

  // 3. Docker (for localnet)
  const docker = Bun.which('docker')
  if (docker) {
    const info = Bun.spawn(['docker', 'info'], { stdout: 'ignore', stderr: 'ignore' })
    if ((await info.exited) === 0) ok('Docker is installed and running')
    else warn('Docker is installed but not running (needed for `vibekit localnet`)')
  } else {
    warn('Docker not found (needed for `vibekit localnet`)')
  }

  // 4. Node (the keystore CLI installs with npm and runs under node)
  if (Bun.which('node')) {
    ok('node found (the keystore daemon runs under it)')
  } else {
    warn('node not found — signing is unavailable; the keystore daemon is a Node program')
  }
  if (!Bun.which('npm')) {
    warn('npm not found — needed once to provision the keystore CLI')
  }

  // 5. Keystore (for signing) — managed install, self-healing via --fix
  if (!isProvisioned()) {
    if (fix) {
      try {
        await provisionKeystoreCli()
        ok(`keystore CLI provisioned (managed, keystore-node@${KEYSTORE_NODE_VERSION})`)
      } catch (err) {
        problems++
        bad(`keystore CLI could not be provisioned: ${err instanceof Error ? err.message : err}`)
      }
    } else {
      warn(
        `keystore CLI not provisioned — any \`vibekit keystore\` command (or doctor --fix) installs the pinned version`,
      )
    }
  } else {
    ok(`keystore CLI managed at the pinned version (${KEYSTORE_NODE_VERSION})`)
  }
  const keystoreSocket =
    process.platform === 'win32'
      ? '\\\\.\\pipe\\algorand-keystore' // keystore-node named pipe
      : join(homedir(), '.algorand-keystore', 'keystore.sock')
  if (existsSync(keystoreSocket)) {
    ok('keystore daemon socket present (signing available)')
  } else {
    warn('keystore daemon not running — `vibekit keystore start` enables signing')
  }

  console.log()
  if (problems > 0) {
    console.log(
      pc.red(`${problems} problem(s) found.`) +
        (fix ? '' : pc.dim(' Re-run with --fix to repair.')),
    )
    process.exitCode = 1
  } else {
    console.log(pc.green('No blocking problems found.'))
  }
}
