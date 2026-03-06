/** Formatted transaction returned by handlers. */
export interface FormattedTransaction {
  id: string
  type: string
  sender: string
  fee: number
  confirmedRound?: number
  roundTime?: number
  paymentAmount?: number
  receiver?: string
  assetId?: number
  assetAmount?: number
  applicationId?: number
  note?: string
  group?: string
  innerTxns?: FormattedTransaction[]
  globalStateDelta?: unknown
  localStateDelta?: unknown
  logs?: string[]
}

/** Formatted account returned by handlers. */
export interface FormattedAccount {
  address: string
  balanceAlgos: number
  totalAssetsOptedIn?: number
  totalAppsOptedIn?: number
  totalCreatedAssets?: number
  totalCreatedApps?: number
  status?: string
  rewardBase?: number
}

/** Formatted asset returned by handlers. */
export interface FormattedAsset {
  assetId: number
  name?: string
  unitName?: string
  totalSupply: string
  decimals: number
  creator?: string
  manager?: string
  reserve?: string
  freeze?: string
  clawback?: string
  defaultFrozen?: boolean
  url?: string
}

/** Formatted block returned by handlers. */
export interface FormattedBlock {
  round: number
  timestamp: number
  transactionCount: number
  proposer?: string
  previousBlockHash?: string
  seed?: string
}

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

/** Asset balance entry. */
export interface AssetBalance {
  address: string
  amount: string
  isFrozen: boolean
}

/** Account asset holding. */
export interface AccountAsset {
  assetId: number
  amount: string
  isFrozen: boolean
}

/** Application log entry. */
export interface LogEntry {
  applicationId: number
  logData: unknown[]
  nextToken?: string
}

/** Network status response. */
export interface NetworkStatus {
  latestRound: number
  version?: string
  dbAvailable?: boolean
}

/** Default result limit for paginated queries. */
export const DEFAULT_LIMIT = 20
