/**
 * What an Explorer app calls for results. Every read returns a versioned
 * StructuredResult; the action and block-tail capabilities are added by
 * the hosts that have them (`ActionHost`, the preset `Host`). The per-view
 * aliases below let a module declare only the reads it needs.
 */
import type { StructuredResult } from '../actions/index.js'
import type { TransactionSearchFilter } from './transaction.js'

/** The named networks a live host can serve; core ships their endpoints. */
export type LiveNetworkId = 'localnet' | 'testnet' | 'mainnet'

export interface ReadHost {
  /** Looks an account's portfolio up as an authoritative record. */
  lookupAccount(address: string): Promise<StructuredResult>
  /** Looks several accounts up as one account.list record. */
  lookupAccounts(addresses: readonly string[]): Promise<StructuredResult>
  /** Lists assets held by an account. */
  lookupAccountAssets(address: string): Promise<StructuredResult>
  /** Lists application local state for apps an account has opted into. */
  lookupAccountAppStates(address: string): Promise<StructuredResult>
  lookupTransaction(txid: string): Promise<StructuredResult>
  /** Every transaction in an atomic group as one transaction.group record. */
  lookupTransactionGroup(groupId: string): Promise<StructuredResult>
  lookupAsset(assetId: number): Promise<StructuredResult>
  lookupApplication(applicationId: number): Promise<StructuredResult>
  lookupBlock(round: number): Promise<StructuredResult>
  /** One page of transactions scoped by account, asset, application, or round. */
  searchTransactions(filter: TransactionSearchFilter): Promise<StructuredResult>
  /** Any of the host's tools by name; paging re-runs a record's own call with its nextToken. */
  callTool(toolName: string, args: Record<string, unknown>): Promise<StructuredResult>
}

export type AccountLookupHost = Pick<
  ReadHost,
  | 'lookupAccount'
  | 'lookupAccounts'
  | 'lookupAccountAssets'
  | 'lookupAccountAppStates'
  | 'searchTransactions'
  | 'callTool'
>
export type TransactionLookupHost = Pick<
  ReadHost,
  'lookupTransaction' | 'lookupTransactionGroup' | 'searchTransactions'
>
export type AssetLookupHost = Pick<ReadHost, 'lookupAsset'>
export type ApplicationLookupHost = Pick<ReadHost, 'lookupApplication'>
export type BlockLookupHost = Pick<ReadHost, 'lookupBlock'>
export type ToolCallHost = Pick<ReadHost, 'callTool'>
/** The three lookups a host runs concurrently for a bare numeric identifier. */
export type EntityLookupHost = AssetLookupHost & ApplicationLookupHost & BlockLookupHost
