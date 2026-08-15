/** Shared application formatting (ported from v1 contracts handlers). */
import type algosdk from 'algosdk'
import { bytesToBase64 } from '@initlabs/core'

type IndexerApplication = InstanceType<typeof import('algosdk').indexerModels.Application>

/** Formatted application returned by handlers. */
export interface FormattedApplication {
  applicationId: number
  creator?: string
  globalState?: Array<{
    key: string
    value: {
      type: number
      bytes?: string
      uint?: number
    }
  }>
  localStateSchema?: { numByteSlice: number; numUint: number }
  globalStateSchema?: { numByteSlice: number; numUint: number }
}

export function formatApplication(app: IndexerApplication): FormattedApplication {
  const params = app.params
  return {
    applicationId: Number(app.id),
    creator: params.creator ? String(params.creator) : undefined,
    globalState: params.globalState?.map((kv: algosdk.indexerModels.TealKeyValue) => ({
      key: bytesToBase64(kv.key),
      value: {
        type: Number(kv.value.type),
        bytes: kv.value.bytes ? bytesToBase64(kv.value.bytes) : undefined,
        uint: kv.value.uint != null ? Number(kv.value.uint) : undefined,
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
