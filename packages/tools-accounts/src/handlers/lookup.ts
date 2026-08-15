import { ToolError, indexerSemaphore as indexerSem, type ToolContext } from '@initlabs/core'
import algosdk from 'algosdk'
import { formatAccount, type FormattedAccount } from './format.js'

export async function lookupAccount(
  ctx: ToolContext,
  args: { address: string },
): Promise<FormattedAccount> {
  if (!algosdk.isValidAddress(args.address)) {
    throw new ToolError('INVALID_ADDRESS', `Invalid Algorand address: ${args.address}`)
  }
  const response = await ctx.indexer.lookupAccountByID(args.address).do()
  return formatAccount(response.account)
}

export async function batchLookupAccounts(
  ctx: ToolContext,
  args: { addresses: string[] },
): Promise<{ accounts: FormattedAccount[] }> {
  const invalid = args.addresses.filter((address) => !algosdk.isValidAddress(address))
  if (invalid.length > 0) {
    throw new ToolError('INVALID_ADDRESS', `Invalid Algorand address(es): ${invalid.join(', ')}`)
  }
  const results = await Promise.allSettled(
    args.addresses.map((address) =>
      indexerSem.run(() =>
        ctx.indexer
          .lookupAccountByID(address)
          .do()
          .then((r) => formatAccount(r.account)),
      ),
    ),
  )
  return {
    accounts: results
      .filter((r): r is PromiseFulfilledResult<FormattedAccount> => r.status === 'fulfilled')
      .map((r) => r.value),
  }
}
