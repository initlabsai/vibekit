/**
 * `vibekit keystore <args>` — passthrough to the keystore-node CLI, with the
 * install managed by vibekit: the pinned version is auto-provisioned into
 * vibekit's data directory (no global install, no lifecycle burden on the
 * user, no version drift). The daemon still runs under node outside our
 * binary — we manage its presence and version, never its code or storage.
 */

import algosdk from 'algosdk'
import pc from 'picocolors'
import { homedir } from 'os'
import { join } from 'path'
import { closeSync, existsSync, openSync, readFileSync, unlinkSync, writeFileSync } from 'fs'
import { mkdir } from 'fs/promises'
import { spawn } from 'node:child_process'

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

/** Connect to the running daemon, or undefined when it is not up. */
async function connectSigner(): Promise<
  import('@initlabs/vibekit-signer-keystore').KeystoreSigner | undefined
> {
  const { createKeystoreSigner } = await import('@initlabs/vibekit-signer-keystore')
  try {
    return await createKeystoreSigner()
  } catch {
    return undefined
  }
}

const DAEMON_HINT = `The keystore daemon is not running. Start it first: ${pc.cyan('vibekit keystore start')}`

/** Where a daemon started by vibekit writes its output. */
export function keystoreLogPath(): string {
  return join(keystoreDataDir(), '..', 'keystore.log')
}

/** The pid of the daemon vibekit itself started; absent when it was started by hand. */
function keystorePidPath(): string {
  return join(keystoreDataDir(), '..', 'keystore.pid')
}

function readDaemonPid(): number | undefined {
  try {
    const pid = Number(readFileSync(keystorePidPath(), 'utf-8').trim())
    return Number.isInteger(pid) && pid > 0 ? pid : undefined
  } catch {
    return undefined
  }
}

/** True when the daemon answers on its socket. */
export async function keystoreDaemonUp(): Promise<boolean> {
  const signer = await connectSigner()
  if (!signer) return false
  await signer.close()
  return true
}

/**
 * Starts the keystore daemon in the background when it is not running, so
 * nobody has to keep a terminal open for it. The child is detached with its
 * output in keystoreLogPath(); it outlives this process and the terminal.
 * Returns whether the daemon is up. Never throws: a failure here degrades
 * the Explorer to sample accounts, it does not block it.
 */
export async function ensureKeystoreDaemon(
  options: {
    quiet?: boolean
    probe?: () => Promise<boolean>
    start?: () => Promise<number | undefined>
    waitMs?: number
  } = {},
): Promise<boolean> {
  const probe = options.probe ?? keystoreDaemonUp
  if (await probe()) return true
  const start =
    options.start ??
    (async () => {
      const bin = await provisionKeystoreCli(options.quiet)
      const log = keystoreLogPath()
      await mkdir(join(log, '..'), { recursive: true })
      const fd = openSync(log, 'a')
      const child = spawn(bin, ['serve'], { detached: true, stdio: ['ignore', fd, fd] })
      child.unref()
      closeSync(fd)
      if (child.pid) writeFileSync(keystorePidPath(), String(child.pid))
      return child.pid
    })
  let pid: number | undefined
  try {
    pid = await start()
  } catch (error) {
    if (!options.quiet) {
      console.error(pc.yellow(`keystore: ${error instanceof Error ? error.message : String(error)}`))
    }
    return false
  }
  const deadline = Date.now() + (options.waitMs ?? 5000)
  while (Date.now() < deadline) {
    await Bun.sleep(200)
    if (await probe()) {
      if (!options.quiet) {
        console.error(pc.dim(`keystore daemon started${pid ? ` (pid ${pid})` : ''} · log ${keystoreLogPath()}`))
      }
      return true
    }
  }
  if (!options.quiet) console.error(pc.yellow(`keystore daemon did not answer in time — see ${keystoreLogPath()}`))
  return false
}

/** `vibekit keystore start` — the daemon in the background, same as `vibekit explore` does. */
async function keystoreStart(): Promise<void> {
  if (await keystoreDaemonUp()) {
    console.log('keystore daemon is already running')
    return
  }
  if (!(await ensureKeystoreDaemon())) process.exit(1)
}

/** `vibekit keystore stop` — stops a daemon that vibekit started (pid file); a hand-run `serve` is yours to stop. */
async function keystoreStop(): Promise<void> {
  const pid = readDaemonPid()
  if (pid !== undefined) {
    try {
      process.kill(pid, 'SIGTERM')
      console.log(`stopped keystore daemon (pid ${pid})`)
    } catch {
      // Stale pid file: the process is already gone.
    }
    try {
      unlinkSync(keystorePidPath())
    } catch {
      // Already removed.
    }
    return
  }
  if (await keystoreDaemonUp()) {
    console.error(pc.yellow('The daemon was not started by vibekit (a `keystore serve` in a terminal?) — stop it there.'))
    process.exit(1)
  }
  console.log('keystore daemon is not running')
}

/** `vibekit keystore status` — up or down, and the pid when vibekit owns it. */
async function keystoreStatus(): Promise<void> {
  const up = await keystoreDaemonUp()
  const pid = readDaemonPid()
  console.log(up ? `keystore daemon is running${pid ? ` (pid ${pid})` : ''}` : 'keystore daemon is not running')
  if (!up) process.exitCode = 1
}

/**
 * `vibekit keystore generate ed25519 [--name <label>]` — through the daemon
 * when it is up. The raw CLI writes the key store directly, and a running
 * daemon does not see keys added that way until it restarts; the daemon's
 * own RPC generate is visible at once. Other generate forms (seed) pass through.
 */
async function keystoreGenerate(args: string[]): Promise<void> {
  const nameAt = args.findIndex((arg) => arg === '--name' || arg.startsWith('--name='))
  const name = nameAt < 0 ? undefined : (args[nameAt]!.split('=')[1] ?? args[nameAt + 1])
  const signer = args[0] === 'ed25519' && (await keystoreDaemonUp()) ? await connectSigner() : undefined
  if (!signer) return passthrough(['generate', ...args])
  try {
    const { address, keyId } = await signer.createAccount(name)
    console.log(`${address}${name ? `  ${pc.cyan(name)}` : ''}  ${pc.dim(keyId)}`)
  } finally {
    await signer.close()
  }
}

/** `vibekit keystore accounts [--json]` — addresses with names and key ids, via the daemon. */
async function keystoreAccounts(args: string[]): Promise<void> {
  const signer = (await ensureKeystoreDaemon()) ? await connectSigner() : undefined
  if (!signer) {
    console.error(pc.red(DAEMON_HINT))
    process.exit(1)
  }
  try {
    const accounts = await signer.listAccounts()
    if (args.includes('--json')) {
      console.log(JSON.stringify(accounts, null, 2))
    } else if (accounts.length === 0) {
      console.log('No signing accounts. Create one: vibekit keystore generate ed25519 --name <label>')
    } else {
      for (const account of accounts) {
        const name = account.name ? `  ${pc.cyan(account.name)}` : ''
        console.log(`${account.address}${name}  ${pc.dim(account.keyId)}`)
      }
    }
  } finally {
    await signer.close()
  }
}

/**
 * `vibekit keystore remove <address|name|key-id> [--yes]` — resolve an
 * account through the daemon and destroy its key. Unresolved non-address
 * targets fall through to the raw keystore CLI, which removes by key id
 * without a daemon.
 */
async function keystoreRemove(args: string[]): Promise<void> {
  const yes = args.includes('--yes') || args.includes('-y')
  const target = args.find((arg) => !arg.startsWith('-'))
  if (!target) {
    console.error(pc.red('usage: vibekit keystore remove <address|name|key-id> [--yes]'))
    process.exit(1)
  }

  const signer = (await ensureKeystoreDaemon()) ? await connectSigner() : undefined
  if (signer) {
    try {
      const accounts = await signer.listAccounts()
      const byName = accounts.filter((account) => account.name === target)
      if (byName.length > 1) {
        console.error(pc.red(`Name "${target}" matches ${byName.length} accounts — remove by address:`))
        for (const account of byName) console.error(`  ${account.address}`)
        process.exit(1)
      }
      const match = accounts.find((account) => account.address === target) ?? byName[0]
      if (match) {
        if (!yes) {
          const { confirm } = await import('../utils/prompts.js')
          const label = match.name ? `${match.name} (${match.address})` : match.address
          const approved = await confirm(
            `Destroy the key for ${label}? Funds on this account become unrecoverable.`,
            false,
          )
          if (!approved) {
            console.log('Kept.')
            return
          }
        }
        const { keyId } = await signer.removeAccount(match.address)
        console.log(`Removed ${match.address} (${keyId})`)
        return
      }
      if (algosdk.isValidAddress(target)) {
        console.error(pc.red(`No key in the keystore daemon for address ${target}`))
        process.exit(1)
      }
      // Not an address and not a known name — likely a raw key id; the
      // keystore CLI handles those (and works without the daemon).
    } finally {
      await signer.close()
    }
  } else if (algosdk.isValidAddress(target)) {
    // Address resolution needs the daemon's address book.
    console.error(pc.red(DAEMON_HINT))
    process.exit(1)
  }
  await passthrough(['remove', target])
}

async function passthrough(args: string[]): Promise<void> {
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

export async function commandKeystore(args: string[]): Promise<void> {
  const [sub = '', ...rest] = args
  if (sub === 'start') return keystoreStart()
  if (sub === 'stop') return keystoreStop()
  if (sub === 'status') return keystoreStatus()
  if (sub === 'generate') return keystoreGenerate(rest)
  if (sub === 'accounts') return keystoreAccounts(rest)
  if (sub === 'remove') return keystoreRemove(rest)
  await passthrough(args)
}
