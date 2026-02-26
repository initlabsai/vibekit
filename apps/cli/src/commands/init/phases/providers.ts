/**
 * Provider Setup Phase
 *
 * Handles provider selection and bootstrap (Vault and/or Keyring).
 */

import * as p from '@clack/prompts'
import pc from 'picocolors'
import type { AccountProviderType } from '@vibekit/provider-interface'
import { isKeyringAvailable } from '@vibekit/keyring'

import { hasMcpToken, isVaultSealed } from '../../../lib/vault'
import type { VaultSetupStatus, KeyringSetupStatus, WalletConnectSetupStatus } from '../../../types'
import { multiselect } from '../../../utils/prompts'
import { vaultBootstrapStep } from './vault'
import { keyringBootstrapStep } from './keyring'
import { walletConnectBootstrapStep } from './walletconnect'

// --- Provider Selection ---

type OptionValue = AccountProviderType

function buildProviderOptions(
  keyringAvailable: boolean,
  vaultAvailable: boolean,
  dockerAvailable: boolean
): {
  options: { value: OptionValue; label: string; hint?: string }[]
  initialValues: OptionValue[]
} {
  const options: { value: OptionValue; label: string; hint?: string }[] = []
  const initialValues: OptionValue[] = []

  if (keyringAvailable) {
    options.push({
      value: 'keyring',
      label: 'Keyring',
      hint: 'OS keyring - keys live in Keychain/libsecret',
    })
    initialValues.push('keyring')
  } else {
    options.push({
      value: 'keyring',
      label: `Keyring ${pc.dim('(unavailable)')}`,
      hint: 'OS keyring not available',
    })
  }

  if (vaultAvailable) {
    options.push({
      value: 'vault',
      label: `Vault ${pc.yellow('[EXPERIMENTAL]')}`,
      hint: 'Keys never leave Vault, requires Docker',
    })
  } else {
    options.push({
      value: 'vault',
      label: `Vault ${pc.yellow('[EXPERIMENTAL]')} ${pc.dim('(requires Docker)')}`,
      hint: dockerAvailable ? 'Start Docker first' : 'Install Docker first',
    })
  }

  // WalletConnect is always available - network check happens at runtime
  options.push({
    value: 'walletconnect',
    label: 'WalletConnect',
    hint: 'Connect mobile wallets (Pera, Defly) - testnet/mainnet only',
  })

  return { options, initialValues }
}

async function promptSelectProviders(
  options: { value: OptionValue; label: string; hint?: string }[],
  initialValues: OptionValue[]
): Promise<OptionValue[]> {
  return multiselect({
    message: 'Select account providers to configure:',
    options,
    initialValues,
    required: true,
  })
}

interface ProviderSelectionResult {
  provider: AccountProviderType
  providers: AccountProviderType[]
}

async function selectProviderStep(
  dockerAvailable: boolean,
  dockerRunning: boolean
): Promise<ProviderSelectionResult> {
  const keyringAvailable = await isKeyringAvailable()
  const vaultAvailable = dockerAvailable && dockerRunning

  const { options, initialValues } = buildProviderOptions(
    keyringAvailable,
    vaultAvailable,
    dockerAvailable
  )

  const selection = await promptSelectProviders(options, initialValues)

  const validProviders: AccountProviderType[] = []
  for (const selected of selection) {
    if (selected === 'vault' && !vaultAvailable) {
      p.log.warn('Vault requires Docker to be running. Skipping vault.')
      continue
    }
    if (selected === 'keyring' && !keyringAvailable) {
      p.log.warn('Keyring is not available on this system. Skipping keyring.')
      p.log.info('On Linux, install libsecret-1-dev:')
      p.log.message(`  ${pc.cyan('sudo apt-get install libsecret-1-dev')}`)
      continue
    }
    validProviders.push(selected)
  }

  if (validProviders.length === 0) {
    p.log.error('No available provider selected.')
    p.log.message(
      `  The providers you selected are not available.\n` +
        `  Please ensure Docker is running for Vault, or install libsecret for Keyring.`
    )
    process.exit(1)
  }

  return {
    provider: validProviders[0],
    providers: validProviders,
  }
}

// --- Provider Setup (orchestration) ---

export interface ProviderSetupResult {
  vaultStatus: VaultSetupStatus
  keyringStatus: KeyringSetupStatus
  walletConnectStatus: WalletConnectSetupStatus
}

export async function setupProvidersStep(
  dockerAvailable: boolean,
  dockerRunning: boolean
): Promise<ProviderSetupResult> {
  // hasMcpToken uses the keyring which may not be available (e.g. missing native binding on Windows)
  let hasToken = false
  try {
    hasToken = await hasMcpToken()
  } catch {
    // Keyring unavailable — skip fast path
  }
  const vaultUnsealed = hasToken && !(await isVaultSealed())
  const keyringAvailable = await isKeyringAvailable()

  // Fast path: Vault already configured and unsealed
  if (hasToken && vaultUnsealed) {
    p.log.success('Vault is already configured')
    return {
      vaultStatus: 'completed',
      keyringStatus: keyringAvailable ? (await keyringBootstrapStep()).status : 'skipped',
      walletConnectStatus: 'skipped',
    }
  }

  // Normal flow: let user select providers
  const { providers } = await selectProviderStep(dockerAvailable, dockerRunning)

  const vaultStatus: VaultSetupStatus = providers.includes('vault')
    ? (await vaultBootstrapStep(dockerAvailable, dockerRunning)).status
    : 'skipped'

  const keyringStatus: KeyringSetupStatus = providers.includes('keyring')
    ? (await keyringBootstrapStep()).status
    : 'skipped'

  const walletConnectStatus: WalletConnectSetupStatus = providers.includes('walletconnect')
    ? (await walletConnectBootstrapStep()).status
    : 'skipped'

  return { vaultStatus, keyringStatus, walletConnectStatus }
}
