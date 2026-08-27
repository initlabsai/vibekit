/**
 * LocalNet container lifecycle: Docker Compose orchestration re-implemented
 * from AlgoKit CLI's sandbox.py. Docker only.
 */

import { homedir } from 'os'
import { join } from 'path'
import { existsSync } from 'fs'
import { mkdir, readFile, writeFile } from 'fs/promises'

import {
  ALGOD_PORT,
  INDEXER_PORT,
  LOCALNET_PROJECT,
  LOCALNET_TOKEN,
  composeFileStatus,
  getAlgodConfigJson,
  getAlgodNetworkTemplate,
  getComposeYaml,
  getConduitYaml,
  type ComposeFileStatus,
} from './compose.js'

export const SERVICE_NAMES = ['algod', 'conduit', 'indexer-db', 'indexer'] as const

/** Where the compose file + configs live. */
export function localnetConfigDir(): string {
  if (process.env.VIBEKIT_LOCALNET_CONFIG_DIR) {
    return process.env.VIBEKIT_LOCALNET_CONFIG_DIR
  }
  const base =
    process.platform === 'win32' && process.env.APPDATA
      ? process.env.APPDATA
      : join(homedir(), '.config')
  return join(base, 'vibekit', 'localnet')
}

// --- Process helpers ---

export interface RunResult {
  exitCode: number
  stdout: string
  stderr: string
}

async function run(cmd: string[], cwd?: string): Promise<RunResult> {
  const proc = Bun.spawn(cmd, { cwd, stdout: 'pipe', stderr: 'pipe' })
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])
  return { exitCode, stdout, stderr }
}

/** Run a command with output streamed to the terminal (for `logs --follow`). */
async function runInteractive(cmd: string[], cwd?: string): Promise<number> {
  const proc = Bun.spawn(cmd, { cwd, stdout: 'inherit', stderr: 'inherit' })
  return proc.exited
}

// --- Docker preflight ---

export type DockerCheck =
  | { ok: true }
  | {
      ok: false
      problem: 'not-installed' | 'no-compose' | 'no-access' | 'not-running'
      message: string
    }

export async function checkDocker(): Promise<DockerCheck> {
  try {
    const version = await run(['docker', '--version'])
    if (version.exitCode !== 0) throw new Error(version.stderr)
  } catch {
    return {
      ok: false,
      problem: 'not-installed',
      message: 'Docker not found; install it from https://docs.docker.com/get-docker/',
    }
  }

  const compose = await run(['docker', 'compose', 'version'])
  if (compose.exitCode !== 0) {
    return {
      ok: false,
      problem: 'no-compose',
      message: 'Docker Compose not found; it is included with Docker Desktop.',
    }
  }

  const info = await run(['docker', 'info'])
  if (info.exitCode !== 0) {
    // A sandboxed agent shell (Codex, pi) or a user outside the docker group
    // gets EACCES on the socket — Docker is fine, this shell just can't see it.
    if (/permission denied/i.test(info.stderr)) {
      return {
        ok: false,
        problem: 'no-access',
        message:
          "This shell can't access the Docker socket (permission denied). Docker may be running fine: " +
          're-run outside the sandbox / with approval, or add your user to the docker group.',
      }
    }
    return { ok: false, problem: 'not-running', message: "Docker isn't running; please start it." }
  }

  return { ok: true }
}

// --- Port ownership ---

/** The compose project whose container publishes a host port. */
export interface PortOwner {
  container: string
  project: string
  workingDir?: string
}

/** Parses `docker ps --format '{{.Names}}\t{{project label}}\t{{working_dir label}}'`. */
export function parsePortOwner(stdout: string): PortOwner | undefined {
  const line = stdout.split('\n').find((candidate) => candidate.trim() !== '')
  if (!line) return undefined
  const [container = '', project = '', workingDir = ''] = line.split('\t')
  if (!container || !project) return undefined
  return { container, project, ...(workingDir ? { workingDir } : {}) }
}

/**
 * Who is serving the algod port right now — ours, AlgoKit's sandbox, or
 * nobody. Read from Docker labels each time; nothing is persisted.
 */
export async function ownerOfPort(port: number = ALGOD_PORT): Promise<PortOwner | undefined> {
  const result = await run([
    'docker',
    'ps',
    '--filter',
    `publish=${port}`,
    '--format',
    '{{.Names}}\t{{.Label "com.docker.compose.project"}}\t{{.Label "com.docker.compose.project.working_dir"}}',
  ])
  if (result.exitCode !== 0) return undefined
  return parsePortOwner(result.stdout)
}

// --- Sandbox ---

export class Sandbox {
  readonly directory: string
  /** A foreign compose project adopted because it already owns the ports. */
  readonly project?: string

  constructor(directory: string = localnetConfigDir(), options: { project?: string } = {}) {
    this.directory = directory
    if (options.project && options.project !== LOCALNET_PROJECT) this.project = options.project
  }

  /** True when lifecycle commands drive someone else's localnet (e.g. AlgoKit's). */
  get adopted(): boolean {
    return this.project !== undefined
  }

  private async readOrNull(file: string): Promise<string | null> {
    try {
      return await readFile(join(this.directory, file), 'utf-8')
    } catch {
      return null
    }
  }

  async fileStatus(): Promise<ComposeFileStatus> {
    return composeFileStatus({
      compose: await this.readOrNull('docker-compose.yml'),
      algodConfig: await this.readOrNull('algod_config.json'),
      networkTemplate: await this.readOrNull('algod_network_template.json'),
    })
  }

  async writeComposeFiles(): Promise<void> {
    await mkdir(this.directory, { recursive: true })
    await writeFile(join(this.directory, 'docker-compose.yml'), getComposeYaml(), 'utf-8')
    await writeFile(join(this.directory, 'conduit.yml'), getConduitYaml(), 'utf-8')
    await writeFile(join(this.directory, 'algod_config.json'), getAlgodConfigJson(), 'utf-8')
    await writeFile(
      join(this.directory, 'algod_network_template.json'),
      getAlgodNetworkTemplate(),
      'utf-8',
    )
    // bind-mounted into the algod container for goal file exchange
    await mkdir(join(this.directory, 'goal_mount'), { recursive: true })
  }

  composeFilesExist(): boolean {
    return this.adopted || existsSync(join(this.directory, 'docker-compose.yml'))
  }

  // An adopted project is driven by name: stop/ps/logs/down work from the
  // containers' labels alone, so its compose files never need to be ours.
  private compose(args: string[]): Promise<RunResult> {
    return this.project
      ? run(['docker', 'compose', '-p', this.project, ...args])
      : run(['docker', 'compose', ...args], this.directory)
  }

  async up(): Promise<void> {
    const result = await this.compose(['up', '--detach', '--quiet-pull', '--wait'])
    if (result.exitCode !== 0) {
      throw new Error(`Failed to start LocalNet: ${result.stderr.trim()}`)
    }
  }

  async stop(): Promise<void> {
    const result = await this.compose(['stop'])
    if (result.exitCode !== 0) {
      throw new Error(`Failed to stop LocalNet: ${result.stderr.trim()}`)
    }
  }

  async down(): Promise<void> {
    await this.compose(['down'])
  }

  async pull(): Promise<void> {
    await this.compose(['pull', '--ignore-pull-failures', '--quiet'])
  }

  async logs(options: { follow?: boolean; tail?: string } = {}): Promise<number> {
    const args = this.project
      ? ['docker', 'compose', '-p', this.project, 'logs']
      : ['docker', 'compose', 'logs']
    if (options.follow) args.push('--follow')
    if (options.tail) args.push('--tail', options.tail)
    return runInteractive(args, this.project ? undefined : this.directory)
  }

  /** `docker compose ps` parsed into service records. */
  async ps(): Promise<Array<Record<string, unknown>>> {
    const result = await this.compose(['ps', '--all', '--format', 'json'])
    if (result.exitCode !== 0) return []

    const output = result.stdout.trim()
    if (!output) return []

    // compose < 2.21 emits a JSON array; newer versions emit JSON-lines
    if (output.startsWith('[')) {
      return JSON.parse(output) as Array<Record<string, unknown>>
    }
    const records: Array<Record<string, unknown>> = []
    for (const line of output.split('\n')) {
      try {
        records.push(JSON.parse(line) as Record<string, unknown>)
      } catch {
        // ignore non-JSON noise (ANSI codes, warnings)
      }
    }
    return records
  }
}

// --- Health checks ---

async function healthCheck(url: string, headers: Record<string, string>): Promise<boolean> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 1_000)
    const response = await fetch(url, { headers, signal: controller.signal })
    clearTimeout(timer)
    return response.ok
  } catch {
    return false
  }
}

async function waitFor(check: () => Promise<boolean>, timeoutSeconds: number): Promise<boolean> {
  const deadline = Date.now() + timeoutSeconds * 1_000
  while (Date.now() < deadline) {
    if (await check()) return true
    await new Promise((resolve) => setTimeout(resolve, 1_000))
  }
  return false
}

export function waitForAlgod(timeoutSeconds = 60): Promise<boolean> {
  return waitFor(
    () =>
      healthCheck(`http://localhost:${ALGOD_PORT}/v2/status`, {
        'X-Algo-API-Token': LOCALNET_TOKEN,
      }),
    timeoutSeconds,
  )
}

export function waitForIndexer(timeoutSeconds = 60): Promise<boolean> {
  return waitFor(() => healthCheck(`http://localhost:${INDEXER_PORT}/health`, {}), timeoutSeconds)
}

// --- Status details ---

export interface ServiceStatus {
  service: string
  running: boolean
  details: Record<string, string>
}

export async function fetchAlgodStatus(): Promise<Record<string, string>> {
  try {
    const headers = { 'X-Algo-API-Token': LOCALNET_TOKEN }
    const [statusRes, versionsRes] = await Promise.all([
      fetch(`http://localhost:${ALGOD_PORT}/v2/status`, { headers }),
      fetch(`http://localhost:${ALGOD_PORT}/versions`, { headers }),
    ])
    if (!statusRes.ok || !versionsRes.ok) return { Status: 'Error' }

    const status = (await statusRes.json()) as {
      'last-round': number
      'time-since-last-round': number
    }
    const versions = (await versionsRes.json()) as {
      genesis_id: string
      genesis_hash_b64: string
      build: { major: number; minor: number; build_number: number }
    }
    return {
      Port: String(ALGOD_PORT),
      'Last round': String(status['last-round']),
      'Time since last round': `${(status['time-since-last-round'] / 1e9).toFixed(1)}s`,
      'Genesis ID': versions.genesis_id,
      'Genesis hash': versions.genesis_hash_b64,
      Version: `${versions.build.major}.${versions.build.minor}.${versions.build.build_number}`,
    }
  } catch {
    return { Status: 'Error' }
  }
}

export async function fetchIndexerStatus(): Promise<Record<string, string>> {
  try {
    const response = await fetch(`http://localhost:${INDEXER_PORT}/health`)
    if (!response.ok) return { Status: 'Error' }
    const health = (await response.json()) as { round: number; version: string }
    return {
      Port: String(INDEXER_PORT),
      'Last round': String(health.round),
      Version: health.version,
    }
  } catch {
    return { Status: 'Error' }
  }
}
