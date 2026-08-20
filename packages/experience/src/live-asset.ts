import { viewDataSchemas } from '@initlabs/vibekit-tools/views'

import { assetDetailDataSchema } from './assets.js'
import type { ResultIdentity } from './live-payment.js'
import { structuredResultSchema, type StructuredResult } from './results.js'
import { EXPERIENCE_PROTOCOL_VERSION } from './version.js'

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
