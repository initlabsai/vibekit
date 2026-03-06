import type algosdk from 'algosdk'
import { formatApplication } from '../formatters.js'
import type { FormattedApplication } from '../types.js'
import { DEFAULT_LIMIT } from '../types.js'

export interface LookupApplicationArgs {
  applicationId: number
}

export async function lookupApplication(
  indexer: algosdk.Indexer,
  args: LookupApplicationArgs
): Promise<FormattedApplication> {
  const response = await indexer.lookupApplications(args.applicationId).do()
  return formatApplication(response.application!)
}

export interface SearchApplicationsArgs {
  limit?: number
  nextToken?: string
  creator?: string
}

export async function searchApplications(
  indexer: algosdk.Indexer,
  args: SearchApplicationsArgs
): Promise<{ applications: FormattedApplication[]; nextToken?: string }> {
  const limit = Math.min(args.limit ?? DEFAULT_LIMIT, 100)
  let query = indexer.searchForApplications().limit(limit)

  if (args.nextToken) query = query.nextToken(args.nextToken)
  if (args.creator) query = query.creator(args.creator)

  const response = await query.do()
  return {
    applications: (response.applications ?? []).map(formatApplication),
    nextToken: response.nextToken,
  }
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
  indexer: algosdk.Indexer,
  args: LookupApplicationLogsArgs
): Promise<{ applicationId: number; logData: unknown[]; nextToken?: string }> {
  const limit = Math.min(args.limit ?? DEFAULT_LIMIT, 100)
  let query = indexer.lookupApplicationLogs(args.applicationId).limit(limit)

  if (args.nextToken) query = query.nextToken(args.nextToken)
  if (args.txid) query = query.txid(args.txid)
  if (args.minRound) query = query.minRound(args.minRound)
  if (args.maxRound) query = query.maxRound(args.maxRound)

  const response = await query.do()
  return {
    applicationId: args.applicationId,
    logData: response.logData ?? [],
    nextToken: response.nextToken,
  }
}
