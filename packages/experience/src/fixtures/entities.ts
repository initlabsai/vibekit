import { FIXTURE_SENDER } from './transaction.js'
import { buildApplicationDetailRecord, type ApplicationLookupHost } from '../live-application.js'
import { buildAssetDetailRecord, type AssetLookupHost } from '../live-asset.js'
import { buildBlockDetailRecord, type BlockLookupHost } from '../live-block.js'
import type { EntityLookupHost } from '../entity-lookup.js'
import type { StructuredResult } from '../results.js'

/** Sample ASA id used when localnet is offline. */
export const FIXTURE_ASSET_ID = 1042

/** Sample application id used when localnet is offline. */
export const FIXTURE_APPLICATION_ID = 1071

/** Sample block round — the confirmation round of the recorded payment. */
export const FIXTURE_BLOCK_ROUND = 22

const ASSET_WIRE = {
  assetId: FIXTURE_ASSET_ID,
  name: 'Sample token',
  unitName: 'SMPL',
  totalSupply: '1000000000',
  decimals: 6,
  creator: FIXTURE_SENDER,
  defaultFrozen: false,
}

const APPLICATION_WIRE = {
  applicationId: FIXTURE_APPLICATION_ID,
  creator: FIXTURE_SENDER,
  globalState: [{ key: 'Y291bnRlcg==', value: { type: 2, uint: 7 } }],
  localStateSchema: { numByteSlice: 0, numUint: 1 },
  globalStateSchema: { numByteSlice: 1, numUint: 1 },
}

const BLOCK_WIRE = {
  round: FIXTURE_BLOCK_ROUND,
  timestamp: 1787169189,
  transactionCount: 1,
  proposer: FIXTURE_SENDER,
  feesCollected: 0.001,
  transactionTypes: [{ type: 'pay', count: 1 }],
}

function identity(kind: string, id: number, counter: number) {
  return {
    resultId: `result-fixture-${kind}-${id}-${counter}`,
    toolCallId: `tool-call-fixture-${kind}-${id}-${counter}`,
    network: 'localnet',
  }
}

/** Adds sample asset, application, and block lookup to a host. */
export function createFixtureEntityLookup(): EntityLookupHost &
  AssetLookupHost &
  ApplicationLookupHost &
  BlockLookupHost {
  let counter = 0
  return {
    async lookupAsset(assetId: number): Promise<StructuredResult> {
      if (assetId !== FIXTURE_ASSET_ID) {
        throw new Error(`No sample asset ${assetId} (try ${FIXTURE_ASSET_ID})`)
      }
      counter += 1
      return buildAssetDetailRecord(identity('asset', assetId, counter), ASSET_WIRE)
    },
    async lookupApplication(applicationId: number): Promise<StructuredResult> {
      if (applicationId !== FIXTURE_APPLICATION_ID) {
        throw new Error(`No sample application ${applicationId} (try ${FIXTURE_APPLICATION_ID})`)
      }
      counter += 1
      return buildApplicationDetailRecord(identity('application', applicationId, counter), APPLICATION_WIRE)
    },
    async lookupBlock(round: number): Promise<StructuredResult> {
      if (round !== FIXTURE_BLOCK_ROUND) {
        throw new Error(`No sample block ${round} (try ${FIXTURE_BLOCK_ROUND})`)
      }
      counter += 1
      return buildBlockDetailRecord(identity('block', round, counter), BLOCK_WIRE)
    },
  }
}
