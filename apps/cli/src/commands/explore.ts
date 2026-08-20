/**
 * `vibekit explore` — launch the private OpenTUI Explorer as a separate
 * process. OpenTUI is not embedded in the compiled CLI binary.
 */
import { existsSync } from 'node:fs'
import { dirname, isAbsolute, join, resolve } from 'node:path'

import pc from 'picocolors'

const TUI_ENTRIES = ['apps/tui/src/index.tsx', 'apps/tui/dist/index.js'] as const
const SIDECAR_NAMES = ['vibekit-tui', 'vibekit-explore'] as const

export interface ResolveExploreOptions {
  env?: Record<string, string | undefined>
  startDirs?: string[]
  exists?: (path: string) => boolean
}

function isSourceEntry(path: string): boolean {
  return path.endsWith('.tsx') || path.endsWith('.ts') || path.endsWith('.js')
}

/** Walks from known starts looking for the TUI source, build output, or a sidecar binary. */
export function resolveExploreEntry(options: ResolveExploreOptions = {}): string | undefined {
  const env = options.env ?? process.env
  const exists = options.exists ?? existsSync
  const override = env.VIBEKIT_EXPLORE
  if (override && exists(override)) return override

  const startDirs = options.startDirs ?? [process.cwd(), import.meta.dir]
  for (const start of startDirs) {
    let dir = resolve(start)
    for (let depth = 0; depth < 8; depth += 1) {
      for (const rel of TUI_ENTRIES) {
        const candidate = join(dir, rel)
        if (exists(candidate)) return candidate
      }
      for (const name of SIDECAR_NAMES) {
        const candidate = join(dir, name)
        if (exists(candidate)) return candidate
      }
      const parent = dirname(dir)
      if (parent === dir) break
      dir = parent
    }
  }
  return undefined
}

function bunCommand(): string {
  const execPath = process.execPath
  const base = execPath.split(/[/\\]/).pop() ?? ''
  if (base === 'bun' || base.startsWith('bun-')) return execPath
  return 'bun'
}

/** Spawns the Explorer TUI and waits until it exits. */
export async function commandExplore(args: string[]): Promise<void> {
  if (args[0] === 'setup') {
    const { commandExploreSetup } = await import('./explore-setup.js')
    await commandExploreSetup(args.slice(1))
    return
  }
  const entry = resolveExploreEntry()
  if (!entry) {
    console.error(`Could not find the Explorer TUI.

From this repository:
  ${pc.cyan('bun run --filter @initlabs/vibekit-tui dev')}

Or set ${pc.cyan('VIBEKIT_EXPLORE')} to the TUI entry (source, dist, or a sidecar binary).`)
    process.exitCode = 1
    return
  }

  const command = isSourceEntry(entry)
    ? [bunCommand(), entry, ...args]
    : [isAbsolute(entry) ? entry : resolve(entry), ...args]
  const proc = Bun.spawn(command, {
    stdin: 'inherit',
    stdout: 'inherit',
    stderr: 'inherit',
    env: process.env,
  })
  const code = await proc.exited
  process.exitCode = code === 0 ? 0 : code
}
