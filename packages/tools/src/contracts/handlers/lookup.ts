import type { AlgorandClient } from '@algorandfoundation/algokit-utils'
import { DEFAULT_LIMIT, stripFinalToken } from '@vibekit/core'
import type { FormattedApplication } from '../types'

type IndexerApplication = InstanceType<typeof import('algosdk').indexerModels.Application>

function formatApplication(app: IndexerApplication): FormattedApplication {
  const params = app.params
  return {
    applicationId: Number(app.id),
    creator: params.creator ? String(params.creator) : undefined,
    globalState: params.globalState?.map((kv) => ({
      key: Buffer.from(kv.key).toString('base64'),
      value: {
        type: kv.value.type,
        bytes: kv.value.bytes ? Buffer.from(kv.value.bytes).toString('base64') : undefined,
        uint: kv.value.uint != null ? Number(kv.value.uint) : undefined,
      },
    })),
    localStateSchema: params.localStateSchema
      ? {
          numByteSlice: params.localStateSchema.numByteSlice,
          numUint: params.localStateSchema.numUint,
        }
      : undefined,
    globalStateSchema: params.globalStateSchema
      ? {
          numByteSlice: params.globalStateSchema.numByteSlice,
          numUint: params.globalStateSchema.numUint,
        }
      : undefined,
  }
}

export async function lookupApplication(
  algorand: AlgorandClient,
  args: { applicationId: number }
): Promise<FormattedApplication> {
  const response = await algorand.client.indexer.lookupApplications(args.applicationId).do()
  return formatApplication(response.application!)
}

export interface LookupApplicationLogsArgs {
  applicationId: number
  limit?: number
  nextToken?: string
  txid?: string
  minRound?: number
  maxRound?: number
}

export async function lookupApplicationLogs(
  algorand: AlgorandClient,
  args: LookupApplicationLogsArgs
): Promise<{ applicationId: number; logData: unknown[]; nextToken?: string }> {
  const indexer = algorand.client.indexer
  const limit = Math.min(args.limit ?? DEFAULT_LIMIT, 100)
  let query = indexer.lookupApplicationLogs(args.applicationId).limit(limit)

  if (args.nextToken) query = query.nextToken(args.nextToken)
  if (args.txid) query = query.txid(args.txid)
  if (args.minRound) query = query.minRound(args.minRound)
  if (args.maxRound) query = query.maxRound(args.maxRound)

  const response = await query.do()
  const logData = response.logData ?? []
  return {
    applicationId: args.applicationId,
    logData,
    nextToken: stripFinalToken(logData.length, limit, response.nextToken),
  }
}
