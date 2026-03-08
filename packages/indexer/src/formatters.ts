import type {
  FormattedTransaction,
  FormattedAccount,
  FormattedAsset,
  FormattedBlock,
  FormattedApplication,
} from './types'

const MICROALGOS_PER_ALGO = 1_000_000

export function microalgosToAlgos(microalgos: number | bigint): number {
  return Number(microalgos) / MICROALGOS_PER_ALGO
}

type IndexerTransaction = InstanceType<typeof import('algosdk').indexerModels.Transaction>
type IndexerAccount = InstanceType<typeof import('algosdk').indexerModels.Account>
type IndexerAsset = InstanceType<typeof import('algosdk').indexerModels.Asset>
type IndexerBlock = InstanceType<typeof import('algosdk').indexerModels.Block>
type IndexerApplication = InstanceType<typeof import('algosdk').indexerModels.Application>

export function formatTransaction(tx: IndexerTransaction): FormattedTransaction {
  const formatted: FormattedTransaction = {
    id: tx.id!,
    type: tx.txType as string,
    sender: String(tx.sender),
    fee: microalgosToAlgos(tx.fee),
    confirmedRound: tx.confirmedRound != null ? Number(tx.confirmedRound) : undefined,
    roundTime: tx.roundTime != null ? Number(tx.roundTime) : undefined,
  }

  if (tx.paymentTransaction) {
    formatted.paymentAmount = microalgosToAlgos(tx.paymentTransaction.amount)
    formatted.receiver = String(tx.paymentTransaction.receiver)
  }

  if (tx.assetTransferTransaction) {
    formatted.assetId = Number(tx.assetTransferTransaction.assetId)
    formatted.assetAmount = Number(tx.assetTransferTransaction.amount)
    formatted.receiver = String(tx.assetTransferTransaction.receiver)
  }

  if (tx.applicationTransaction) {
    formatted.applicationId = Number(tx.applicationTransaction.applicationId)
  }

  if (tx.note && tx.note.length > 0) {
    try {
      formatted.note = new TextDecoder().decode(tx.note)
    } catch {
      formatted.note = Buffer.from(tx.note).toString('base64')
    }
  }

  if (tx.group) {
    formatted.group = Buffer.from(tx.group).toString('base64')
  }

  if (tx.innerTxns && tx.innerTxns.length > 0) {
    formatted.innerTxns = tx.innerTxns.map(formatTransaction)
  }

  if (tx.globalStateDelta) {
    formatted.globalStateDelta = tx.globalStateDelta
  }

  if (tx.localStateDelta) {
    formatted.localStateDelta = tx.localStateDelta
  }

  if (tx.logs && tx.logs.length > 0) {
    formatted.logs = tx.logs.map((l) => Buffer.from(l).toString('base64'))
  }

  return formatted
}

export function formatAccount(account: IndexerAccount): FormattedAccount {
  return {
    address: String(account.address),
    balanceAlgos: microalgosToAlgos(account.amount),
    totalAssetsOptedIn: account.totalAssetsOptedIn,
    totalAppsOptedIn: account.totalAppsOptedIn,
    totalCreatedAssets: account.totalCreatedAssets,
    totalCreatedApps: account.totalCreatedApps,
    status: account.status,
    rewardBase: account.rewardBase != null ? Number(account.rewardBase) : undefined,
    createdAtRound: account.createdAtRound != null ? Number(account.createdAtRound) : undefined,
  }
}

export function formatAsset(asset: IndexerAsset): FormattedAsset {
  const params = asset.params
  return {
    assetId: Number(asset.index),
    name: params.name,
    unitName: params.unitName,
    totalSupply: String(params.total),
    decimals: params.decimals,
    creator: params.creator ? String(params.creator) : undefined,
    manager: params.manager ? String(params.manager) : undefined,
    reserve: params.reserve ? String(params.reserve) : undefined,
    freeze: params.freeze ? String(params.freeze) : undefined,
    clawback: params.clawback ? String(params.clawback) : undefined,
    defaultFrozen: params.defaultFrozen,
    url: params.url,
  }
}

export function formatBlock(block: IndexerBlock): FormattedBlock {
  return {
    round: Number(block.round),
    timestamp: Number(block.timestamp!),
    transactionCount: block.transactions?.length ?? 0,
    proposer: block.proposer ? String(block.proposer) : undefined,
    feesCollected: block.feesCollected != null ? microalgosToAlgos(block.feesCollected) : undefined,
    proposerPayout: block.proposerPayout != null ? microalgosToAlgos(block.proposerPayout) : undefined,
    previousBlockHash: block.previousBlockHash
      ? Buffer.from(block.previousBlockHash).toString('base64')
      : undefined,
    seed: block.seed ? Buffer.from(block.seed).toString('base64') : undefined,
  }
}

export function formatAssetAmount(rawAmount: string, decimals: number): string {
  const num = BigInt(rawAmount)
  if (decimals === 0) return Number(num).toLocaleString('en-US')
  const divisor = BigInt(10 ** decimals)
  const whole = num / divisor
  const frac = num % divisor
  const fracStr = frac.toString().padStart(decimals, '0').replace(/0+$/, '')
  if (!fracStr) return Number(whole).toLocaleString('en-US')
  return `${Number(whole).toLocaleString('en-US')}.${fracStr}`
}

export function formatApplication(app: IndexerApplication): FormattedApplication {
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
