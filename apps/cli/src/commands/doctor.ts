/**
 * `vibekit doctor` — diagnose (and with --fix, repair) the things that
 * actually break setups in the wild: a leftover 0.x binary shadowing this
 * one on PATH, broken or legacy vibekit MCP entries in the project's
 * .mcp.json, and missing Docker / keystore prerequisites.
 */

import pc from 'picocolors'
import { homedir } from 'os'
import { basename, join } from 'path'
import { existsSync, readFileSync } from 'fs'
import { unlink, copyFile } from 'fs/promises'

import { LEGACY_SERVER_KEY, MCP_ENV } from '../config/mcps.js'
import { isProvisioned, provisionKeystoreCli, KEYSTORE_NODE_VERSION } from './keystore.js'
import { writeJsonFile } from '../utils/files.js'
import { resolveVibekitPath } from '../utils/paths.js'
import { run } from '../utils/run.js'

/** 0.x env vars that mean nothing to this release's server. */
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

type McpConfig = { mcpServers?: Record<string, McpServerEntry>; [key: string]: unknown }

/** Diagnose the vibekit-related entries of a parsed .mcp.json. Pure. */
export function diagnoseMcpConfig(
  config: McpConfig,
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
 * Rewrite the vibekit entry to a known-good shape (current binary + env),
 * dropping the legacy key. All other servers are preserved. Pure.
 */
export function fixMcpConfig(config: McpConfig, binaryPath: string): McpConfig {
  const servers = { ...(config.mcpServers ?? {}) }
  delete servers[LEGACY_SERVER_KEY]
  servers['vibekit'] = { command: binaryPath, args: ['mcp'], env: { ...MCP_ENV } }
  return { ...config, mcpServers: servers }
}

/** 0.x fingerprint: its help advertises vault/dispenser command trees. */
export function looksLikeV1(helpText: string): boolean {
  return helpText.includes('vault') && helpText.includes('dispenser')
}

async function helpTextOf(binary: string): Promise<string> {
  try {
    return (await run([binary, '--help'])).stdout
  } catch {
    return ''
  }
}

// --- The checks. Each prints its own lines and answers with its final state. ---

type Health = 'ok' | 'warn' | 'bad'

const ok = (message: string): Health => (console.log(`${pc.green('✓')} ${message}`), 'ok')
const warn = (message: string): Health => (console.log(`${pc.yellow('!')} ${message}`), 'warn')
const bad = (message: string, fixHint?: string): Health => {
  console.log(`${pc.red('✗')} ${message}`)
  if (fixHint) console.log(pc.dim(`  fix: ${fixHint}`))
  return 'bad'
}

/** This CLI's own on-disk path: the compiled binary, or bin/vibekit from source. */
const self = () =>
  resolveVibekitPath(
    process.argv[1],
    process.execPath,
    join(import.meta.dir, '..', '..', 'bin', 'vibekit'),
  )

async function checkBinaryOnPath(onPath: string | null, legacy: boolean, fix: boolean) {
  if (!onPath) {
    return warn(
      `vibekit is not on PATH (running from ${self()}) — agent configs use absolute paths, so this is fine`,
    )
  }
  if (!legacy) return ok(`vibekit on PATH: ${onPath}`)
  const me = self()
  if (fix && existsSync(me) && basename(me) === 'vibekit' && me !== onPath) {
    await unlink(onPath) // survives "text file busy" when a 0.x process is live
    await copyFile(me, onPath)
    return ok(`replaced the legacy vibekit on PATH with this binary (${me})`)
  }
  return bad(
    `legacy vibekit found on PATH (the previous 0.x release, github.com/gabrielkuettel/vibekit): ${onPath}`,
    'vibekit doctor --fix (replaces it with this binary)',
  )
}

async function checkMcpConfig(binary: string, fix: boolean) {
  const mcpPath = join(process.cwd(), '.mcp.json')
  if (!existsSync(mcpPath)) {
    return warn(`no .mcp.json in this directory — run \`vibekit init\` to configure agents here`)
  }
  let config: McpConfig = {}
  try {
    config = JSON.parse(readFileSync(mcpPath, 'utf-8')) as McpConfig
  } catch {
    return bad('.mcp.json is not valid JSON')
  }
  const issues = diagnoseMcpConfig(config)
  if (issues.length === 0) return ok('.mcp.json vibekit entry looks healthy')
  if (issues.length === 1 && issues[0]!.code === 'no-vibekit-entry') {
    return warn(`.mcp.json has no vibekit server — run \`vibekit init\` to add it`)
  }
  for (const issue of issues) console.log(`${pc.red('✗')} .mcp.json: ${issue.message}`)
  if (!fix) return bad(`${issues.length} issue(s) in .mcp.json`, 'vibekit doctor --fix')
  await writeJsonFile(mcpPath, fixMcpConfig(config, binary))
  return ok(`rewrote the vibekit entry (command: ${binary}); other servers untouched`)
}

async function checkDocker() {
  if (!Bun.which('docker')) return warn('Docker not found (needed for `vibekit localnet`)')
  const info = await run(['docker', 'info']).catch(() => ({ exitCode: 1 }))
  return info.exitCode === 0
    ? ok('Docker is installed and running')
    : warn('Docker is installed but not running (needed for `vibekit localnet`)')
}

function checkNode() {
  // The keystore CLI installs with npm and runs under node.
  if (!Bun.which('npm')) warn('npm not found — needed once to provision the keystore CLI')
  return Bun.which('node')
    ? ok('node found (the keystore daemon runs under it)')
    : warn('node not found — signing is unavailable; the keystore daemon is a Node program')
}

async function checkKeystore(fix: boolean) {
  let health: Health
  if (isProvisioned()) {
    health = ok(`keystore CLI managed at the pinned version (${KEYSTORE_NODE_VERSION})`)
  } else if (!fix) {
    health = warn(
      `keystore CLI not provisioned — any \`vibekit keystore\` command (or doctor --fix) installs the pinned version`,
    )
  } else {
    try {
      await provisionKeystoreCli()
      health = ok(`keystore CLI provisioned (managed, keystore-node@${KEYSTORE_NODE_VERSION})`)
    } catch (err) {
      health = bad(
        `keystore CLI could not be provisioned: ${err instanceof Error ? err.message : err}`,
      )
    }
  }
  const socket =
    process.platform === 'win32'
      ? '\\\\.\\pipe\\algorand-keystore' // keystore-node named pipe
      : join(homedir(), '.algorand-keystore', 'keystore.sock')
  if (existsSync(socket)) ok('keystore daemon socket present (signing available)')
  else warn('keystore daemon not running — `vibekit keystore start` enables signing')
  return health
}

export async function commandDoctor(args: string[]): Promise<void> {
  const fix = args.includes('--fix')
  const onPath = Bun.which('vibekit')
  const legacyOnPath = onPath ? looksLikeV1(await helpTextOf(onPath)) : false
  // Configs point at the healthy binary on PATH, else at this one.
  const binary = onPath && !legacyOnPath ? onPath : self()

  const results = [
    await checkBinaryOnPath(onPath, legacyOnPath, fix),
    await checkMcpConfig(binary, fix),
    await checkDocker(),
    checkNode(),
    await checkKeystore(fix),
  ]
  const problems = results.filter((health) => health === 'bad').length

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
