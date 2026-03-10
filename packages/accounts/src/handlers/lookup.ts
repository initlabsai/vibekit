import type { AlgorandClient } from '@algorandfoundation/algokit-utils'
import { indexerSemaphore as indexerSem } from '@vibekit/core'
import type { FormattedAccount } from '../types'

const MICROALGOS_PER_ALGO = 1_000_000

type IndexerAccount = InstanceType<typeof import('algosdk').indexerModels.Account>

function formatAccount(account: IndexerAccount): FormattedAccount {
  return {
    address: String(account.address),
    balanceAlgos: Number(account.amount) / MICROALGOS_PER_ALGO,
    totalAssetsOptedIn: account.totalAssetsOptedIn,
    totalAppsOptedIn: account.totalAppsOptedIn,
    totalCreatedAssets: account.totalCreatedAssets,
    totalCreatedApps: account.totalCreatedApps,
    status: account.status,
    rewardBase: account.rewardBase != null ? Number(account.rewardBase) : undefined,
    createdAtRound: account.createdAtRound != null ? Number(account.createdAtRound) : undefined,
  }
}

export async function lookupAccount(
  algorand: AlgorandClient,
  args: { address: string }
): Promise<FormattedAccount> {
  const response = await algorand.client.indexer.lookupAccountByID(args.address).do()
  return formatAccount(response.account)
}

export async function batchLookupAccounts(
  algorand: AlgorandClient,
  args: { addresses: string[] }
): Promise<{ accounts: FormattedAccount[] }> {
  const results = await Promise.allSettled(
    args.addresses.map((address) =>
      indexerSem.run(() =>
        algorand.client.indexer
          .lookupAccountByID(address)
          .do()
          .then((r) => formatAccount(r.account))
      )
    )
  )
  return {
    accounts: results
      .filter((r): r is PromiseFulfilledResult<FormattedAccount> => r.status === 'fulfilled')
      .map((r) => r.value),
  }
}
