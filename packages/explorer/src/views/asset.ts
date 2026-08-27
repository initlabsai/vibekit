import { z } from 'zod'

import { uint64JsonSchema } from '../format.js'
import { algorandAddressCandidateSchema } from '../input.js'
import type { ResultIdentity, StructuredResult } from '../core/results.js'
import { record, viewModelFor } from './derive.js'

const optionalAddress = z.string().min(1).optional()

/**
 * Authoritative asset data required by the trusted asset detail view.
 * Extra wire fields are dropped.
 */
export const assetDetailDataSchema = z.object({
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

/** Authoritative asset data required by the trusted asset detail view. */
export type AssetDetailData = z.infer<typeof assetDetailDataSchema>

/** One asset row in the search catalog. */
export const assetRowSchema = z.object({
  assetId: uint64JsonSchema,
  name: z.string().min(1).optional(),
  unitName: z.string().min(1).optional(),
  totalSupply: z.string().regex(/^\d+$/),
  decimals: z.number().int().nonnegative(),
  creator: optionalAddress,
})

/** A page of catalog assets (search_assets). */
export const assetListDataSchema = z.object({
  assets: z.array(assetRowSchema),
  nextToken: z.string().min(1).optional(),
})

/** One asset an account holds; amount is raw base units, scaled by decimals for display. */
export const assetHoldingRowSchema = z.object({
  assetId: uint64JsonSchema,
  amount: z.string().min(1),
  isFrozen: z.boolean(),
  decimals: z.number().int().nonnegative().optional(),
  name: z.string().min(1).optional(),
  unitName: z.string().min(1).optional(),
})

/** A page of one account's asset holdings (get_account_assets). */
export const assetHoldingsDataSchema = z.object({
  assets: z.array(assetHoldingRowSchema),
  nextToken: z.string().min(1).optional(),
})

/** One holder of an asset. */
export const assetHolderRowSchema = z.object({
  address: z.string().min(1),
  amount: z.string().min(1),
  isFrozen: z.boolean(),
})

/** A page of asset holders; amounts are raw base units, scaled by decimals for display. */
export const assetHoldersDataSchema = z.object({
  balances: z.array(assetHolderRowSchema),
  decimals: z.number().int().nonnegative().optional(),
  nextToken: z.string().min(1).optional(),
})

export type AssetListData = z.infer<typeof assetListDataSchema>
export type AssetHoldingsData = z.infer<typeof assetHoldingsDataSchema>
export type AssetHoldersData = z.infer<typeof assetHoldersDataSchema>

/** Wraps a lookup_asset result as an asset detail record. */
export function buildAssetDetailRecord(
  identity: ResultIdentity,
  wire: unknown,
  toolName = 'lookup_asset',
): StructuredResult {
  return record(identity, toolName, assetDetailDataSchema.parse(wire))
}

/** Wraps search_assets. */
export function buildAssetListRecord(
  identity: ResultIdentity,
  wire: unknown,
  toolName = 'search_assets',
): StructuredResult {
  return record(identity, toolName, assetListDataSchema.parse(wire))
}

/** Wraps get_account_assets. */
export function buildAssetHoldingsRecord(
  identity: ResultIdentity,
  wire: unknown,
  toolName = 'get_account_assets',
): StructuredResult {
  return record(identity, toolName, assetHoldingsDataSchema.parse(wire))
}

/** Wraps search_asset_balances. */
export function buildAssetHoldersRecord(
  identity: ResultIdentity,
  wire: unknown,
  toolName = 'search_asset_balances',
): StructuredResult {
  return record(identity, toolName, assetHoldersDataSchema.parse(wire))
}

/** Derives asset presentation from one trusted result reference. */
export const createAssetDetailViewModel = viewModelFor(
  assetDetailDataSchema,
  'asset.detail' as const,
  'Asset detail',
)
export const createAssetListViewModel = viewModelFor(
  assetListDataSchema,
  'asset.list' as const,
  'Asset list',
)
export const createAssetHoldingsViewModel = viewModelFor(
  assetHoldingsDataSchema,
  'asset.holdings' as const,
  'Asset holdings',
)
export const createAssetHoldersViewModel = viewModelFor(
  assetHoldersDataSchema,
  'asset.holders' as const,
  'Asset holders',
)

/** Renderer-ready semantic model for the trusted asset detail view. */
export type AssetDetailViewModel = Extract<
  ReturnType<typeof createAssetDetailViewModel>,
  { ok: true }
>['model']
export type AssetListViewModel = Extract<
  ReturnType<typeof createAssetListViewModel>,
  { ok: true }
>['model']
export type AssetHoldingsViewModel = Extract<
  ReturnType<typeof createAssetHoldingsViewModel>,
  { ok: true }
>['model']
export type AssetHoldersViewModel = Extract<
  ReturnType<typeof createAssetHoldersViewModel>,
  { ok: true }
>['model']

export type { AssetLookupHost } from '../host.js'
