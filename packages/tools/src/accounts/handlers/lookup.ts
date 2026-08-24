import { ToolError, indexerSemaphore as indexerSem, type ToolContext } from '@initlabs/vibekit-core'
import algosdk from 'algosdk'
import { isNotFound } from '../../shared/errors.js'
import { formatAccount, type FormattedAccount } from './format.js'

export async function lookupAccount(
  ctx: ToolContext,
  args: { address: string },
): Promise<FormattedAccount> {
  if (!algosdk.isValidAddress(args.address)) {
    throw new ToolError('INVALID_ADDRESS', `Invalid Algorand address: ${args.address}`)
  }
  try {
    const response = await ctx.indexer.lookupAccountByID(args.address).exclude('all').do()
    return formatAccount(response.account)
  } catch (error) {
    if (isNotFound(error)) {
      throw new ToolError(
        'ACCOUNT_NOT_FOUND',
        `${args.address} has no on-chain history on this network (never funded)`,
      )
    }
    throw error
  }
}

export async function batchLookupAccounts(
  ctx: ToolContext,
  args: { addresses: string[] },
): Promise<{ accounts: FormattedAccount[]; missing: string[] }> {
  const invalid = args.addresses.filter((address) => !algosdk.isValidAddress(address))
  if (invalid.length > 0) {
    throw new ToolError('INVALID_ADDRESS', `Invalid Algorand address(es): ${invalid.join(', ')}`)
  }
  const results = await Promise.allSettled(
    args.addresses.map((address) =>
      indexerSem.run(() =>
        ctx.indexer
          .lookupAccountByID(address)
          .exclude('all')
          .do()
          .then((r) => formatAccount(r.account)),
      ),
    ),
  )
  return {
    accounts: results
      .filter((r): r is PromiseFulfilledResult<FormattedAccount> => r.status === 'fulfilled')
      .map((r) => r.value),
    missing: args.addresses.filter((_, i) => results[i]!.status === 'rejected'),
  }
}
