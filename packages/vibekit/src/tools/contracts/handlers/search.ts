import { DEFAULT_LIMIT, stripFinalToken, type ToolContext } from '../../../core/index.js'
import { formatApplication, type FormattedApplication } from '../lib/format.js'

export interface SearchApplicationsArgs {
  limit?: number
  nextToken?: string
  creator?: string
}

export async function searchApplications(
  ctx: ToolContext,
  args: SearchApplicationsArgs,
): Promise<{ applications: FormattedApplication[]; nextToken?: string }> {
  const limit = Math.min(args.limit ?? DEFAULT_LIMIT, 100)
  let query = ctx.indexer.searchForApplications().limit(limit)

  if (args.nextToken) query = query.nextToken(args.nextToken)
  if (args.creator) query = query.creator(args.creator)

  const response = await query.do()
  const applications = (response.applications ?? []).map(formatApplication)
  return {
    applications,
    nextToken: stripFinalToken(applications.length, limit, response.nextToken),
  }
}
