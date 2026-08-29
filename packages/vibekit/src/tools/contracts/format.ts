/** Shared application formatting. */
import { knownAppLabel } from '../shared/known-apps.js'
import type algosdk from 'algosdk'
import { bytesToBase64 } from '../../core/index.js'

type IndexerApplication = InstanceType<typeof import('algosdk').indexerModels.Application>

/** Formatted application returned by handlers. */
export interface FormattedApplication {
  applicationId: number
  applicationLabel?: string
  creator?: string
  globalState?: Array<{
    /** base64-encoded state key. */
    key: string
    value: {
      type: number
      /** base64-encoded bytes value (bytes-typed entries only). */
      bytes?: string
      /** uint64 state; jsonSafe emits number, or decimal string above 2^53. */
      uint?: bigint
    }
  }>
  localStateSchema?: { numByteSlice: number; numUint: number }
  globalStateSchema?: { numByteSlice: number; numUint: number }
  createdAtRound?: number
  /** Present only once the app is gone; the round it was deleted in. */
  deleted?: boolean
  deletedAtRound?: number
}

export function formatApplication(app: IndexerApplication): FormattedApplication {
  const params = app.params
  return {
    applicationId: Number(app.id),
    applicationLabel: knownAppLabel(Number(app.id)),
    creator: params.creator ? String(params.creator) : undefined,
    createdAtRound: app.createdAtRound === undefined ? undefined : Number(app.createdAtRound),
    ...(app.deleted
      ? {
          deleted: true,
          deletedAtRound: app.deletedAtRound === undefined ? undefined : Number(app.deletedAtRound),
        }
      : {}),
    globalState: params.globalState?.map((kv: algosdk.indexerModels.TealKeyValue) => ({
      key: bytesToBase64(kv.key),
      value: {
        type: Number(kv.value.type),
        // Empty Uint8Array is truthy — uint entries carry empty bytes; omit them.
        bytes: kv.value.bytes?.length ? bytesToBase64(kv.value.bytes) : undefined,
        // Raw bigint: uint64 state can exceed 2^53 (Number() would silently round).
        uint: kv.value.uint,
      },
    })),
    localStateSchema: params.localStateSchema
      ? {
          numByteSlice: Number(params.localStateSchema.numByteSlice),
          numUint: Number(params.localStateSchema.numUint),
        }
      : undefined,
    globalStateSchema: params.globalStateSchema
      ? {
          numByteSlice: Number(params.globalStateSchema.numByteSlice),
          numUint: Number(params.globalStateSchema.numUint),
        }
      : undefined,
  }
}
