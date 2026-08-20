import { viewDataSchemas } from '@initlabs/vibekit-tools/views'
import { z } from 'zod'

import { uint64JsonSchema } from '../core/algo.js'
import { algorandAddressCandidateSchema } from '../core/classifier.js'
import type { ViewSpec } from '../core/protocol.js'
import {
  resolveResultReference,
  structuredResultSchema,
  type ResultIdentity,
  type ResultStore,
  type StructuredResult,
  type ViewModelError,
} from '../core/results.js'
import { EXPERIENCE_PROTOCOL_VERSION } from '../core/version.js'
import { record, viewModelFor } from './derive.js'

const optionalAddress = z.string().min(1).optional()

/** Authoritative asset data required by the trusted asset detail view. */
export const assetDetailDataSchema = z
  .object({
    assetId: uint64JsonSchema,
    name: z.string().min(1).optional(),
    unitName: z.string().min(1).optional(),
    totalSupply: z.string().regex(/^\d+$/),
    decimals: z.number().int().nonnegative(),
    creator: algorandAddressCandidateSchema.optional(),
    manager: algorandAddressCandidateSchema.optional(),
    reserve: algorandAddressCandidateSchema.optional(),
    freeze: algorandAddressCandidateSchema.optional(),
    clawback: algorandAddressCandidateSchema.optional(),
    defaultFrozen: z.boolean().optional(),
    url: z.string().min(1).optional(),
  })
  .strict()

/** Authoritative asset data required by the trusted asset detail view. */
export type AssetDetailData = z.infer<typeof assetDetailDataSchema>

/** One asset row in the search catalog. */
export const assetRowSchema = z
  .object({
    assetId: uint64JsonSchema,
    name: z.string().min(1).optional(),
    unitName: z.string().min(1).optional(),
    totalSupply: z.string().regex(/^\d+$/),
    decimals: z.number().int().nonnegative(),
    creator: optionalAddress,
  })
  .strict()

/** A page of catalog assets (search_assets). */
export const assetListDataSchema = z
  .object({
    assets: z.array(assetRowSchema),
    nextToken: z.string().min(1).optional(),
  })
  .strict()

/** One asset an account holds, with its balance. */
export const assetHoldingRowSchema = z
  .object({
    assetId: uint64JsonSchema,
    amount: z.string().min(1),
    isFrozen: z.boolean(),
    name: z.string().min(1).optional(),
    unitName: z.string().min(1).optional(),
  })
  .strict()

/** A page of one account's asset holdings (get_account_assets). */
export const assetHoldingsDataSchema = z
  .object({
    assets: z.array(assetHoldingRowSchema),
    nextToken: z.string().min(1).optional(),
  })
  .strict()

/** One holder of an asset. */
export const assetHolderRowSchema = z
  .object({
    address: z.string().min(1),
    amount: z.string().min(1),
    isFrozen: z.boolean(),
  })
  .strict()

/** A page of asset holders. */
export const assetHoldersDataSchema = z
  .object({
    balances: z.array(assetHolderRowSchema),
    nextToken: z.string().min(1).optional(),
  })
  .strict()

export type AssetListData = z.infer<typeof assetListDataSchema>
export type AssetHoldingsData = z.infer<typeof assetHoldingsDataSchema>
export type AssetHoldersData = z.infer<typeof assetHoldersDataSchema>

/** The capability of looking an asset up as an authoritative record. */
export interface AssetLookupHost {
  lookupAsset(assetId: number): Promise<StructuredResult>
}

/** Wraps a lookup_asset result as an asset detail record. */
export function buildAssetDetailRecord(
  identity: ResultIdentity,
  wire: unknown,
  toolName = 'lookup_asset',
): StructuredResult {
  const asset = viewDataSchemas['asset.detail'].parse(wire)
  return structuredResultSchema.parse({
    protocolVersion: EXPERIENCE_PROTOCOL_VERSION,
    type: 'result',
    state: 'success',
    resultId: identity.resultId,
    toolCallId: identity.toolCallId,
    toolName,
    network: identity.network,
    data: assetDetailDataSchema.parse(asset),
  })
}

/** Wraps search_assets. */
export function buildAssetListRecord(
  identity: ResultIdentity,
  wire: unknown,
  toolName = 'search_assets',
): StructuredResult {
  const page = viewDataSchemas['asset.list'].parse(wire)
  return record(
    identity,
    toolName,
    assetListDataSchema.parse({
      assets: page.assets.map((asset) => ({
        assetId: asset.assetId,
        totalSupply: asset.totalSupply,
        decimals: asset.decimals,
        ...(asset.name === undefined ? {} : { name: asset.name }),
        ...(asset.unitName === undefined ? {} : { unitName: asset.unitName }),
        ...(asset.creator === undefined ? {} : { creator: asset.creator }),
      })),
      ...(page.nextToken === undefined ? {} : { nextToken: page.nextToken }),
    }),
  )
}

/** Wraps get_account_assets. */
export function buildAssetHoldingsRecord(
  identity: ResultIdentity,
  wire: unknown,
  toolName = 'get_account_assets',
): StructuredResult {
  const page = viewDataSchemas['asset.holdings'].parse(wire)
  return record(
    identity,
    toolName,
    assetHoldingsDataSchema.parse({
      assets: page.assets,
      ...(page.nextToken === undefined ? {} : { nextToken: page.nextToken }),
    }),
  )
}

/** Wraps search_asset_balances. */
export function buildAssetHoldersRecord(
  identity: ResultIdentity,
  wire: unknown,
  toolName = 'search_asset_balances',
): StructuredResult {
  const page = viewDataSchemas['asset.holders'].parse(wire)
  return record(
    identity,
    toolName,
    assetHoldersDataSchema.parse({
      balances: page.balances,
      ...(page.nextToken === undefined ? {} : { nextToken: page.nextToken }),
    }),
  )
}

/** Renderer-ready semantic model for the trusted asset detail view. */
export const assetDetailViewModelSchema = z
  .object({
    view: z.literal('asset.detail'),
    network: z.string().min(1),
    assetId: assetDetailDataSchema.shape.assetId,
    name: z.string().min(1).optional(),
    unitName: z.string().min(1).optional(),
    totalSupply: z.string().regex(/^\d+$/),
    decimals: z.number().int().nonnegative(),
    creator: z.string().optional(),
    manager: z.string().optional(),
    reserve: z.string().optional(),
    freeze: z.string().optional(),
    clawback: z.string().optional(),
    defaultFrozen: z.boolean().optional(),
    url: z.string().optional(),
  })
  .strict()

/** Renderer-ready semantic model for the trusted asset detail view. */
export type AssetDetailViewModel = z.infer<typeof assetDetailViewModelSchema>

/** Result of deriving the renderer-ready asset detail model. */
export type AssetDetailViewModelResult =
  { ok: true; model: AssetDetailViewModel } | { ok: false; error: ViewModelError }

/** Derives asset presentation from one trusted result reference. */
export function createAssetDetailViewModel(
  store: ResultStore,
  view: ViewSpec,
): AssetDetailViewModelResult {
  const resolution = resolveResultReference(store, view.source)
  if (!resolution.ok) return resolution

  const parsed = assetDetailDataSchema.safeParse(resolution.value)
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: 'INVALID_VIEW_DATA',
        message: 'Asset result did not match the trusted asset schema',
      },
    }
  }
  return {
    ok: true,
    model: assetDetailViewModelSchema.parse({
      view: 'asset.detail',
      network: resolution.record.network,
      ...parsed.data,
    }),
  }
}

export const createAssetListViewModel = viewModelFor(assetListDataSchema, 'asset.list' as const, 'Asset list')
export const createAssetHoldingsViewModel = viewModelFor(assetHoldingsDataSchema, 'asset.holdings' as const, 'Asset holdings')
export const createAssetHoldersViewModel = viewModelFor(assetHoldersDataSchema, 'asset.holders' as const, 'Asset holders')

export type AssetListViewModel = Extract<ReturnType<typeof createAssetListViewModel>, { ok: true }>['model']
export type AssetHoldingsViewModel = Extract<
  ReturnType<typeof createAssetHoldingsViewModel>,
  { ok: true }
>['model']
export type AssetHoldersViewModel = Extract<
  ReturnType<typeof createAssetHoldersViewModel>,
  { ok: true }
>['model']
