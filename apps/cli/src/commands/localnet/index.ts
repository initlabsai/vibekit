/**
 * `vibekit localnet` — start/stop/reset/status/fund/logs for the local
 * Algorand network. A subset of AlgoKit CLI's localnet command group.
 */

import * as p from '@clack/prompts'
import pc from 'picocolors'

import {
  Sandbox,
  SERVICE_NAMES,
  checkDocker,
  fetchAlgodStatus,
  fetchIndexerStatus,
  waitForAlgod,
  waitForIndexer,
  ownerOfPort,
} from './sandbox.js'
import { LOCALNET_PROJECT } from './compose.js'
import { DEFAULT_FUND_MICROALGOS, fundFromKmd } from './fund.js'

function localnetHelp(): void {
  console.log(`
${pc.bold('vibekit localnet')} — manage the local Algorand network (Docker)

${pc.bold('Usage:')}
  vibekit localnet start            Start LocalNet (writes config on first run)
  vibekit localnet stop             Stop LocalNet containers
  vibekit localnet reset            Recreate LocalNet from scratch (--update pulls new images)
  vibekit localnet status           Show container + node health
  vibekit localnet fund <addr>      Fund an account from the dispenser (--amount ALGO, default 10)
  vibekit localnet logs             Show container logs (--follow, --tail N)

Endpoints once running:
  algod    http://localhost:4001   (token: 64 x 'a')
  indexer  http://localhost:8980
  kmd      http://localhost:4002
`)
}

async function ensureDocker(): Promise<void> {
  const check = await checkDocker()
  if (!check.ok) {
    p.log.error(check.message)
    process.exit(1)
  }
}

async function prepareComposeFiles(sandbox: Sandbox): Promise<void> {
  const status = await sandbox.fileStatus()
  if (status === 'missing') {
    await sandbox.writeComposeFiles()
  } else if (status === 'out-of-date') {
    p.log.warn('LocalNet definition is out of date; run `vibekit localnet reset` to update it.')
  }
}

async function waitHealthy(s: ReturnType<typeof p.spinner>): Promise<void> {
  s.message('Waiting for algod...')
  const algodOk = await waitForAlgod()
  s.message('Waiting for indexer...')
  const indexerOk = algodOk && (await waitForIndexer())

  if (algodOk && indexerOk) {
    s.stop('LocalNet is up')
    p.note(
      [
        `algod    ${pc.cyan('http://localhost:4001')}`,
        `indexer  ${pc.cyan('http://localhost:8980')}`,
        `kmd      ${pc.cyan('http://localhost:4002')}`,
        '',
        pc.dim(`Fund an account: vibekit localnet fund <address>`),
      ].join('\n'),
      'LocalNet ready',
    )
  } else {
    s.stop('LocalNet started but failed its health check')
    p.log.warn('Containers are up but algod/indexer did not become healthy in time.')
    p.log.info('Check `vibekit localnet logs` or retry with `vibekit localnet reset`.')
    process.exitCode = 1
  }
}

/**
 * The sandbox that currently owns the localnet ports: ours by default, or a
 * foreign compose project (AlgoKit's) adopted so stop/status/logs act on the
 * localnet that is actually serving — there is only ever one at 4001.
 */
async function currentSandbox(): Promise<Sandbox> {
  const owner = await ownerOfPort()
  return new Sandbox(undefined, owner ? { project: owner.project } : {})
}

async function commandStart(): Promise<void> {
  await ensureDocker()
  const owner = await ownerOfPort()
  if (owner && owner.project !== LOCALNET_PROJECT) {
    // Someone else's localnet is already up: use it rather than fight for the ports.
    const s = p.spinner()
    s.start(`LocalNet already running as ${pc.cyan(owner.project)} — adopting it...`)
    await waitHealthy(s)
    return
  }
  const sandbox = new Sandbox()
  await prepareComposeFiles(sandbox)

  const s = p.spinner()
  s.start('Starting LocalNet...')
  try {
    await sandbox.up()
  } catch (error) {
    s.stop('Failed to start LocalNet')
    p.log.error(error instanceof Error ? error.message : String(error))
    p.log.info(
      "If another localnet is running (e.g. AlgoKit's), stop it first — they share ports 4001/4002/8980.",
    )
    process.exit(1)
  }
  await waitHealthy(s)
}

async function commandStop(): Promise<void> {
  await ensureDocker()
  const sandbox = await currentSandbox()
  if (!sandbox.composeFilesExist()) {
    p.log.info('LocalNet has not been initialized; run `vibekit localnet start` first.')
    return
  }
  const s = p.spinner()
  s.start(sandbox.adopted ? `Stopping LocalNet (${sandbox.project})...` : 'Stopping LocalNet...')
  try {
    await sandbox.stop()
    s.stop(
      sandbox.adopted
        ? `LocalNet (${sandbox.project}) stopped — \`vibekit localnet start\` to start it again`
        : 'LocalNet stopped — `vibekit localnet start` to start it again',
    )
  } catch (error) {
    s.stop('Failed to stop LocalNet')
    p.log.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
}

async function commandReset(args: string[]): Promise<void> {
  await ensureDocker()
  const update = args.includes('--update')
  const owner = await ownerOfPort()
  if (owner && owner.project !== LOCALNET_PROJECT) {
    // Recreating it means driving another tool's compose files; leave that to the tool.
    p.log.error(
      `The running LocalNet belongs to ${pc.cyan(owner.project)}. Reset it with that tool ` +
        `(e.g. ${pc.cyan('algokit localnet reset')}), or stop it and run ${pc.cyan('vibekit localnet start')}.`,
    )
    process.exit(1)
  }
  const sandbox = new Sandbox()

  const s = p.spinner()
  s.start('Resetting LocalNet...')
  try {
    if (sandbox.composeFilesExist()) {
      await sandbox.down()
    }
    await sandbox.writeComposeFiles()
    if (update) {
      s.message('Pulling latest images...')
      await sandbox.pull()
    }
    s.message('Starting LocalNet...')
    await sandbox.up()
  } catch (error) {
    s.stop('Failed to reset LocalNet')
    p.log.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
  await waitHealthy(s)
}

async function commandStatus(): Promise<void> {
  await ensureDocker()
  const sandbox = await currentSandbox()

  const ps = await sandbox.ps()
  const byService = new Map(ps.map((record) => [String(record.Service), record]))

  if (sandbox.adopted) {
    console.log(pc.dim(`LocalNet adopted from compose project ${pc.cyan(sandbox.project!)}\n`))
  } else if (SERVICE_NAMES.some((name) => !byService.has(name))) {
    p.log.error('LocalNet has not been initialized yet; run `vibekit localnet start`.')
    process.exit(1)
  }

  // Ours has a fixed service set; an adopted project is reported as it is.
  const services = sandbox.adopted ? [...byService.keys()].sort() : [...SERVICE_NAMES]
  let allRunning = true
  for (const name of services) {
    const record = byService.get(name)!
    const running = record.State === 'running'
    allRunning &&= running

    console.log(pc.bold(`# ${name}`))
    console.log(`Status: ${running ? pc.green('Running') : pc.red('Not running')}`)

    if (running && name === 'algod') {
      for (const [key, value] of Object.entries(await fetchAlgodStatus())) {
        console.log(`${pc.bold(key + ':')} ${value}`)
      }
    }
    if (running && name === 'indexer') {
      for (const [key, value] of Object.entries(await fetchIndexerStatus())) {
        console.log(`${pc.bold(key + ':')} ${value}`)
      }
    }
    console.log()
  }

  if (!allRunning) {
    p.log.error('At least one container is not running; execute `vibekit localnet start`.')
    process.exit(1)
  }
}

function parseAmountAlgo(args: string[]): bigint {
  const index = args.indexOf('--amount')
  if (index === -1) return DEFAULT_FUND_MICROALGOS
  const raw = args[index + 1]
  const algos = Number(raw)
  if (raw === undefined || !Number.isFinite(algos) || algos <= 0) {
    throw new Error(`Invalid --amount: ${raw} (expected a positive number of ALGO)`)
  }
  return BigInt(Math.round(algos * 1_000_000))
}

async function commandFund(args: string[]): Promise<void> {
  let address: string | undefined
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--amount') {
      i++ // skip the flag's value
    } else if (!args[i]!.startsWith('-')) {
      address = args[i]
      break
    }
  }
  if (!address) {
    p.log.error('Usage: vibekit localnet fund <address> [--amount ALGO]')
    process.exit(1)
  }

  const s = p.spinner()
  s.start('Funding account...')
  try {
    const amount = parseAmountAlgo(args)
    const result = await fundFromKmd(address, amount)
    s.stop(
      `Funded ${pc.cyan(address)} with ${pc.green(`${Number(result.amount) / 1_000_000} ALGO`)} (tx ${result.txId})`,
    )
  } catch (error) {
    s.stop('Funding failed')
    p.log.error(error instanceof Error ? error.message : String(error))
    p.log.info('Is the localnet running? Check with `vibekit localnet status`.')
    process.exit(1)
  }
}

async function commandLogs(args: string[]): Promise<void> {
  await ensureDocker()
  const sandbox = await currentSandbox()
  if (!sandbox.composeFilesExist()) {
    p.log.info('LocalNet has not been initialized; run `vibekit localnet start` first.')
    return
  }
  const tailIndex = args.indexOf('--tail')
  const exitCode = await sandbox.logs({
    follow: args.includes('--follow') || args.includes('-f'),
    ...(tailIndex !== -1 && args[tailIndex + 1] ? { tail: args[tailIndex + 1] } : {}),
  })
  process.exitCode = exitCode
}

export async function commandLocalnet(args: string[]): Promise<void> {
  const [subcommand, ...rest] = args

  switch (subcommand) {
    case 'start':
      return commandStart()
    case 'stop':
      return commandStop()
    case 'reset':
      return commandReset(rest)
    case 'status':
      return commandStatus()
    case 'fund':
      return commandFund(rest)
    case 'logs':
      return commandLogs(rest)
    default:
      localnetHelp()
      if (subcommand && subcommand !== '--help' && subcommand !== '-h') {
        p.log.error(`Unknown localnet command: ${subcommand}`)
        process.exit(1)
      }
  }
}
