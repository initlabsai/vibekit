import {
  DEFAULT_LIMIT,
  ToolError,
  bytesToBase64,
  formatAssetAmount,
  indexerSemaphore as indexerSem,
  stripFinalToken,
  type ToolContext,
} from '@initlabs/vibekit-core'
import algosdk from 'algosdk'
import type { AccountAppLocalState, AccountAsset } from './format.js'

export interface GetAccountAssetsArgs {
  address: string
  limit?: number
  nextToken?: string
}

export async function getAccountAssets(
  ctx: ToolContext,
  args: GetAccountAssetsArgs,
): Promise<{ assets: AccountAsset[]; nextToken?: string }> {
  if (!algosdk.isValidAddress(args.address)) {
    throw new ToolError('INVALID_ADDRESS', `Invalid Algorand address: ${args.address}`)
  }
  const limit = Math.min(args.limit ?? DEFAULT_LIMIT, 100)
  let query = ctx.indexer.lookupAccountAssets(args.address).limit(limit)

  if (args.nextToken) query = query.nextToken(args.nextToken)

  const response = await query.do()
  const holdings = (response.assets ?? []).map((a) => ({
    assetId: Number(a.assetId),
    amount: String(a.amount),
    isFrozen: a.isFrozen as boolean,
  }))

  const metadataResults = await Promise.allSettled(
    holdings.map((h) => indexerSem.run(() => ctx.indexer.lookupAssetByID(h.assetId).do())),
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
  ctx: ToolContext,
  args: GetAccountAppLocalStatesArgs,
): Promise<{ appLocalStates: AccountAppLocalState[]; nextToken?: string }> {
  if (!algosdk.isValidAddress(args.address)) {
    throw new ToolError('INVALID_ADDRESS', `Invalid Algorand address: ${args.address}`)
  }
  const limit = Math.min(args.limit ?? DEFAULT_LIMIT, 100)
  let query = ctx.indexer.lookupAccountAppLocalStates(args.address).limit(limit)

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
      key: bytesToBase64(kv.key),
      value: {
        type: kv.value.type,
        bytes: kv.value.bytes ? bytesToBase64(kv.value.bytes) : undefined,
        uint: kv.value.uint !== undefined ? Number(kv.value.uint) : undefined,
      },
    })),
  }))

  return {
    appLocalStates,
    nextToken: stripFinalToken(appLocalStates.length, limit, response.nextToken),
  }
}
