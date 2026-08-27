import { DEFAULT_LIMIT, ToolError, stripFinalToken, type ToolContext } from '../../../core/index.js'
import { formatApplication, type FormattedApplication } from '../lib/format.js'

export async function lookupApplication(
  ctx: ToolContext,
  args: { applicationId: number },
): Promise<FormattedApplication> {
  const response = await ctx.indexer.lookupApplications(args.applicationId).do()
  if (!response.application) {
    throw new ToolError('APP_NOT_FOUND', `Application not found: ${args.applicationId}`)
  }
  return formatApplication(response.application)
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
  ctx: ToolContext,
  args: LookupApplicationLogsArgs,
): Promise<{ applicationId: number; logData: unknown[]; nextToken?: string }> {
  const limit = Math.min(args.limit ?? DEFAULT_LIMIT, 100)
  let query = ctx.indexer.lookupApplicationLogs(args.applicationId).limit(limit)

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
