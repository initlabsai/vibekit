import { Buffer } from 'buffer'
import type { AlgorandClient } from '@algorandfoundation/algokit-utils'
import {
  DEFAULT_LIMIT,
  stripFinalToken,
  formatAssetAmount,
  indexerSemaphore as indexerSem,
} from '@vibekit/core'
import type { AccountAsset, AccountAppLocalState } from '../types'

export interface GetAccountAssetsArgs {
  address: string
  limit?: number
  nextToken?: string
}

export async function getAccountAssets(
  algorand: AlgorandClient,
  args: GetAccountAssetsArgs
): Promise<{ assets: AccountAsset[]; nextToken?: string }> {
  const indexer = algorand.client.indexer
  const limit = Math.min(args.limit ?? DEFAULT_LIMIT, 100)
  let query = indexer.lookupAccountAssets(args.address).limit(limit)

  if (args.nextToken) query = query.nextToken(args.nextToken)

  const response = await query.do()
  const holdings = (response.assets ?? []).map((a) => ({
    assetId: Number(a.assetId),
    amount: String(a.amount),
    isFrozen: a.isFrozen as boolean,
  }))

  const metadataResults = await Promise.allSettled(
    holdings.map((h) => indexerSem.run(() => indexer.lookupAssetByID(h.assetId).do()))
  )

  const assets: AccountAsset[] = holdings.map((h, i) => {
    const meta = metadataResults[i]
    if (meta.status === 'fulfilled') {
      const params = meta.value.asset?.params
      const decimals = params?.decimals != null ? Number(params.decimals) : undefined
      return {
        ...h,
        amount: decimals != null ? formatAssetAmount(h.amount, decimals) : h.amount,
        name: params?.name as string | undefined,
        unitName: params?.unitName as string | undefined,
      }
    }
    return h
  })

  return { assets, nextToken: stripFinalToken(holdings.length, limit, response.nextToken) }
}

export interface GetAccountAppLocalStatesArgs {
  address: string
  limit?: number
  nextToken?: string
  applicationId?: number
}

export async function getAccountAppLocalStates(
  algorand: AlgorandClient,
  args: GetAccountAppLocalStatesArgs
): Promise<{ appLocalStates: AccountAppLocalState[]; nextToken?: string }> {
  const indexer = algorand.client.indexer
  const limit = Math.min(args.limit ?? DEFAULT_LIMIT, 100)
  let query = indexer.lookupAccountAppLocalStates(args.address).limit(limit)

  if (args.nextToken) query = query.nextToken(args.nextToken)
  if (args.applicationId) query = query.applicationID(args.applicationId)

  const response = await query.do()
  const appLocalStates = (response.appsLocalStates ?? []).map((state) => ({
    applicationId: Number(state.id),
    schema: {
      numByteSlice: Number(state.schema.numByteSlice),
      numUint: Number(state.schema.numUint),
    },
    keyValue: (state.keyValue ?? []).map((kv) => ({
      key: Buffer.from(kv.key).toString('base64'),
      value: {
        type: kv.value.type,
        bytes: kv.value.bytes ? Buffer.from(kv.value.bytes).toString('base64') : undefined,
        uint: kv.value.uint !== undefined ? Number(kv.value.uint) : undefined,
      },
    })),
  }))

  return {
    appLocalStates,
    nextToken: stripFinalToken(appLocalStates.length, limit, response.nextToken),
  }
}
