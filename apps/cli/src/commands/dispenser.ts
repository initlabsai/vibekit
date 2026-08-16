/**
 * `vibekit dispenser` — the one-time human grant for TestNet funding (§6
 * secrets policy: credentials enter via human channels). Device-flow OAuth
 * against the Foundation dispenser; the token is sealed in the keystore
 * daemon's secrets store, where the fund_testnet_account tool consumes it.
 */

import * as p from '@clack/prompts'
import pc from 'picocolors'

import {
  createKeystoreSigner,
  DISPENSER_SECRET_ID,
  hasDispenserToken,
  loadDispenserToken,
  pollForToken,
  requestDeviceCode,
  saveDispenserToken,
  type KeystoreSigner,
} from '@initlabs/vibekit-signer-keystore'

async function openDaemonSecrets(): Promise<KeystoreSigner> {
  try {
    const signer = await createKeystoreSigner()
    if (!signer.secrets) {
      await signer.close()
      throw new Error('daemon has no secrets store')
    }
    return signer
  } catch {
    console.error(
      pc.red('The keystore daemon is not running — the dispenser token lives there.') +
        pc.dim('\nStart it with `vibekit keystore serve`, then retry.'),
    )
    process.exit(1)
  }
}

async function commandLogin(): Promise<void> {
  const signer = await openDaemonSecrets()
  try {
    const device = await requestDeviceCode()
    p.note(
      [
        `1. Open: ${pc.cyan(device.verification_uri_complete)}`,
        `2. Confirm the code: ${pc.bold(pc.yellow(device.user_code))}`,
      ].join('\n'),
      'TestNet Dispenser Login',
    )

    const s = p.spinner()
    s.start('Waiting for you to finish in the browser...')
    const token = await pollForToken(device)
    await saveDispenserToken(signer.secrets!, token)
    s.stop('Logged in — token sealed in the keystore daemon')
    console.log(
      pc.dim(
        token.refreshToken
          ? 'Refresh token stored: funding stays available without re-login.'
          : 'No refresh token granted: you may need to re-login when the session expires.',
      ),
    )
    console.log(pc.dim('Restart your MCP/agent session so fund_testnet_account registers.'))
  } catch (error) {
    p.log.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  } finally {
    await signer.close()
  }
}

async function commandLogout(): Promise<void> {
  const signer = await openDaemonSecrets()
  try {
    await signer.secrets!.remove(DISPENSER_SECRET_ID)
    console.log('Dispenser token removed from the keystore daemon.')
  } catch {
    console.log('No dispenser token was stored.')
  } finally {
    await signer.close()
  }
}

async function commandStatus(): Promise<void> {
  const signer = await openDaemonSecrets()
  try {
    if (!(await hasDispenserToken(signer.secrets!))) {
      console.log(`${pc.yellow('!')} No dispenser session — run \`vibekit dispenser login\``)
      return
    }
    const token = await loadDispenserToken(signer.secrets!)
    const fresh = token !== null && Date.now() < token.expiresAt
    console.log(`${pc.green('✓')} Dispenser token sealed in the keystore daemon`)
    console.log(
      `  access token: ${fresh ? pc.green('valid') : pc.yellow('stale (will auto-refresh on use)')}` +
        ` · refresh token: ${token?.refreshToken ? pc.green('present') : pc.yellow('absent')}`,
    )
  } finally {
    await signer.close()
  }
}

export async function commandDispenser(args: string[]): Promise<void> {
  switch (args[0]) {
    case 'login':
      return commandLogin()
    case 'logout':
      return commandLogout()
    case 'status':
      return commandStatus()
    default:
      console.log(`
${pc.bold('vibekit dispenser')} — TestNet dispenser session (one-time human grant)

  vibekit dispenser login     Device-flow login; token sealed in the keystore daemon
  vibekit dispenser status    Show session state
  vibekit dispenser logout    Remove the token

Once logged in, agents fund testnet accounts via the ${pc.cyan('fund_testnet_account')} tool.
`)
  }
}
