/**
 * `vibekit keystore <args>` — passthrough to the keystore-node CLI, with the
 * install managed by vibekit: the pinned version is auto-provisioned into
 * vibekit's data directory (no global install, no lifecycle burden on the
 * user, no version drift). The daemon still runs under node outside our
 * binary — we manage its presence and version, never its code or storage.
 */

import pc from 'picocolors'
import { homedir } from 'os'
import { join } from 'path'
import { existsSync, readFileSync } from 'fs'
import { mkdir } from 'fs/promises'

/** The one place the keystore-node version lives; bump with a tested release. */
export const KEYSTORE_NODE_VERSION = '1.0.0-canary.3'

/**
 * Data-dir policy (intentional, review-noted): tool installs are DATA ->
 * XDG_DATA_HOME / LOCALAPPDATA; localnet compose files are CONFIG ->
 * ~/.config / APPDATA (see localnet/sandbox.ts). macOS uses the XDG-style
 * paths deliberately - CLI tooling convention over ~/Library.
 */
export function keystoreDataDir(): string {
  const base =
    process.env.XDG_DATA_HOME ??
    (process.platform === 'win32' && process.env.LOCALAPPDATA
      ? process.env.LOCALAPPDATA
      : join(homedir(), '.local', 'share'))
  return join(base, 'vibekit', 'keystore-cli', KEYSTORE_NODE_VERSION)
}

export function managedKeystoreBin(dir: string = keystoreDataDir()): string {
  return join(dir, 'node_modules', '.bin', 'keystore')
}

export function isProvisioned(dir: string = keystoreDataDir()): boolean {
  const pkg = join(dir, 'node_modules', '@algorandfoundation', 'keystore-node', 'package.json')
  if (!existsSync(pkg)) return false
  try {
    return (JSON.parse(readFileSync(pkg, 'utf-8')) as { version?: string }).version === KEYSTORE_NODE_VERSION
  } catch {
    return false
  }
}

/** Install the pinned keystore-node into the managed dir. Requires npm (golden-path dep). */
export async function provisionKeystoreCli(quiet = false): Promise<string> {
  const dir = keystoreDataDir()
  if (isProvisioned(dir)) return managedKeystoreBin(dir)

  if (!Bun.which('npm')) {
    throw new Error(
      'npm is required to provision the keystore CLI (node/npm are already needed for template projects).',
    )
  }

  if (!quiet) console.error(pc.dim(`Provisioning keystore-node@${KEYSTORE_NODE_VERSION} into ${dir} ...`))
  await mkdir(dir, { recursive: true })
  const proc = Bun.spawn(
    ['npm', 'install', '--prefix', dir, '--no-fund', '--no-audit', `@algorandfoundation/keystore-node@${KEYSTORE_NODE_VERSION}`],
    { stdout: 'ignore', stderr: 'pipe' },
  )
  if ((await proc.exited) !== 0) {
    const stderr = await new Response(proc.stderr).text()
    throw new Error(`Failed to provision keystore-node: ${stderr.trim().split('\n').at(-1)}`)
  }
  if (!quiet) console.error(pc.dim('Provisioned.'))
  return managedKeystoreBin(dir)
}

export async function commandKeystore(args: string[]): Promise<void> {
  let bin: string
  try {
    bin = await provisionKeystoreCli()
  } catch (error) {
    console.error(pc.red(error instanceof Error ? error.message : String(error)))
    process.exit(1)
  }

  const proc = Bun.spawn([bin, ...args], { stdin: 'inherit', stdout: 'inherit', stderr: 'inherit' })
  process.exitCode = await proc.exited
}
