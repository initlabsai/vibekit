/**
 * list_accounts tool
 *
 * Lists all available accounts from all configured providers with their balances.
 * Each account shows which provider it belongs to.
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import type { AccountProviderType } from '@vibekit/provider-interface'
import type { ToolContext } from '../types.js'
import { listAccountsForTools } from '../../lib/account-service.js'

export const listAccountsTool: Tool = {
  name: 'list_accounts',
  description:
    'List all available accounts from all configured providers with their balances. ' +
    'Each account shows which provider it belongs to (vault, keyring, or walletconnect).',
  inputSchema: {
    type: 'object',
    properties: {},
  },
}

interface AccountInfo {
  name: string
  address: string
  balance: string
  provider: AccountProviderType
}

export async function handleListAccounts(
  _args: Record<string, unknown>,
  ctx: ToolContext
): Promise<{
  network: string
  accounts: AccountInfo[]
  activeAccount: string | null
  hint: string
}> {
  const { algorand, config } = ctx
  const { accounts: rawAccounts, activeAccount } = await listAccountsForTools(algorand)

  // Convert balances to strings and sort by balance descending
  const accounts: AccountInfo[] = rawAccounts
    .map((a) => ({
      name: a.name,
      address: a.address,
      balance: a.balance.toString(),
      provider: a.provider,
    }))
    .sort((a, b) => (BigInt(b.balance) > BigInt(a.balance) ? 1 : -1))

  const hint =
    accounts.length === 0
      ? 'No accounts found. Use create_account to create one.'
      : activeAccount
        ? `Active: ${activeAccount}. Transactions will be signed by this account. Use switch_account to change.`
        : config.network === 'localnet'
          ? 'No account selected. Transactions will use the localnet dispenser. Use switch_account to sign as a specific account.'
          : 'No account selected. Use switch_account to select an account before sending transactions.'

  return {
    network: config.network,
    accounts,
    activeAccount,
    hint,
  }
}
