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
      ? { numByteSlice: params.localStateSchema.numByteSlice, numUint: params.localStateSchema.numUint }
      : undefined,
    globalStateSchema: params.globalStateSchema
      ? { numByteSlice: params.globalStateSchema.numByteSlice, numUint: params.globalStateSchema.numUint }
      : undefined,
  }
}

export interface SearchApplicationsArgs {
  limit?: number
  nextToken?: string
  creator?: string
}

export async function searchApplications(
  algorand: AlgorandClient,
  args: SearchApplicationsArgs
): Promise<{ applications: FormattedApplication[]; nextToken?: string }> {
  const indexer = algorand.client.indexer
  const limit = Math.min(args.limit ?? DEFAULT_LIMIT, 100)
  let query = indexer.searchForApplications().limit(limit)

  if (args.nextToken) query = query.nextToken(args.nextToken)
  if (args.creator) query = query.creator(args.creator)

  const response = await query.do()
  const applications = (response.applications ?? []).map(formatApplication)
  return {
    applications,
    nextToken: stripFinalToken(applications.length, limit, response.nextToken),
  }
}
