import { z } from 'zod'

import { assetDetailDataSchema } from './assets.js'
import { algorandAddressCandidateSchema } from './classifier.js'
import { uint64JsonSchema } from './algo.js'
import type { ResultIdentity } from './live-payment.js'
import { structuredResultSchema, type StructuredResult } from './results.js'
import { EXPERIENCE_PROTOCOL_VERSION } from './version.js'

const optionalAddress = algorandAddressCandidateSchema.optional()

/** The JSON-safe wire subset of lookup_asset this slice consumes. */
export const assetWireSchema = z.object({
  assetId: uint64JsonSchema,
  name: z.string().min(1).optional(),
  unitName: z.string().min(1).optional(),
  totalSupply: z.union([z.string().regex(/^\d+$/), z.number().int().nonnegative()]).optional(),
  total: z.union([z.string().regex(/^\d+$/), z.number().int().nonnegative()]).optional(),
  decimals: z.number().int().nonnegative(),
  creator: optionalAddress,
  manager: optionalAddress,
  reserve: optionalAddress,
  freeze: optionalAddress,
  clawback: optionalAddress,
  defaultFrozen: z.boolean().optional(),
  url: z.string().min(1).optional(),
})

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
  const asset = assetWireSchema.parse(wire)
  return structuredResultSchema.parse({
    protocolVersion: EXPERIENCE_PROTOCOL_VERSION,
    type: 'result',
    state: 'success',
    resultId: identity.resultId,
    toolCallId: identity.toolCallId,
    toolName,
    network: identity.network,
    data: assetDetailDataSchema.parse({
      assetId: asset.assetId,
      totalSupply: String(asset.totalSupply ?? asset.total ?? 0),
      decimals: asset.decimals,
      ...(asset.name === undefined ? {} : { name: asset.name }),
      ...(asset.unitName === undefined ? {} : { unitName: asset.unitName }),
      ...(asset.creator === undefined ? {} : { creator: asset.creator }),
      ...(asset.manager === undefined ? {} : { manager: asset.manager }),
      ...(asset.reserve === undefined ? {} : { reserve: asset.reserve }),
      ...(asset.freeze === undefined ? {} : { freeze: asset.freeze }),
      ...(asset.clawback === undefined ? {} : { clawback: asset.clawback }),
      ...(asset.defaultFrozen === undefined ? {} : { defaultFrozen: asset.defaultFrozen }),
      ...(asset.url === undefined ? {} : { url: asset.url }),
    }),
  })
}
