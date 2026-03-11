/**
 * Asset write handlers
 *
 * Domain logic for asset creation and management operations.
 * All handlers delegate to sendTransactions from @vibekit/transactions.
 */

import type { AlgorandClient } from '@algorandfoundation/algokit-utils'
import type { ResolveSenderFn, ResolveAppSpecFn } from '@vibekit/core'
import {
  validateRequiredPositiveAmount,
  validateDecimals,
  validateAssetName,
  validateUnitName,
  validateAssetUrl,
  validateOptionalAddress,
  validateMetadataHash,
  validateRequiredId,
  validateRequiredAmount,
  validateRequiredAddress,
  validateRequiredBoolean,
  validateNote,
} from '@vibekit/core'
import { sendTransactions } from '@vibekit/transactions'

// ============================================================================
// create_asset
// ============================================================================

export interface CreateAssetArgs {
  total: number
  decimals?: number
  assetName?: string
  unitName?: string
  url?: string
  metadataHash?: string
  defaultFrozen?: boolean
  manager?: string
  reserve?: string
  freeze?: string
  clawback?: string
  sender?: string
}

export async function createAsset(
  algorand: AlgorandClient,
  args: CreateAssetArgs,
  resolveSender: ResolveSenderFn
) {
  const {
    total,
    decimals = 0,
    assetName,
    unitName,
    url,
    metadataHash,
    defaultFrozen = false,
    manager,
    reserve,
    freeze,
    clawback,
    sender,
  } = args

  validateRequiredPositiveAmount(total, 'total')
  validateDecimals(decimals)
  validateAssetName(assetName)
  validateUnitName(unitName)
  validateAssetUrl(url)
  validateOptionalAddress(manager, 'manager')
  validateOptionalAddress(reserve, 'reserve')
  validateOptionalAddress(freeze, 'freeze')
  validateOptionalAddress(clawback, 'clawback')
  validateMetadataHash(metadataHash)

  const { address: senderAddress } = await resolveSender(algorand, sender)

  const result = await sendTransactions(
    {
      transactions: [
        {
          type: 'asset_create',
          total,
          decimals,
          assetName,
          unitName,
          url,
          metadataHash,
          defaultFrozen,
          manager: manager || senderAddress,
          reserve,
          freeze,
          clawback,
          sender,
        },
      ],
    },
    algorand,
    resolveSender
  )

  return {
    success: true,
    assetId: Number(result.assetId),
    txId: result.txIds[0],
    confirmedRound: result.confirmedRound ?? 0,
    creator: senderAddress,
  }
}

// ============================================================================
// asset_transfer
// ============================================================================

export interface TransferAssetArgs {
  assetId: number
  amount: number
  receiver: string
  sender?: string
  clawbackTarget?: string
  closeAssetTo?: string
  note?: string
}

export async function transferAsset(
  algorand: AlgorandClient,
  args: TransferAssetArgs,
  resolveSender: ResolveSenderFn
) {
  const { assetId, amount, receiver, sender, clawbackTarget, closeAssetTo, note } = args

  validateRequiredId(assetId, 'assetId')
  validateRequiredAmount(amount)
  validateRequiredAddress(receiver, 'receiver')
  validateOptionalAddress(clawbackTarget, 'clawbackTarget')
  validateOptionalAddress(closeAssetTo, 'closeAssetTo')
  if (note) validateNote(note)

  const { address: senderAddress } = await resolveSender(algorand, sender)

  const result = await sendTransactions(
    {
      transactions: [
        {
          type: 'asset_transfer',
          assetId,
          receiver,
          amount,
          sender,
          clawbackTarget,
          closeAssetTo,
          note,
        },
      ],
    },
    algorand,
    resolveSender
  )

  return {
    success: true,
    txId: result.txIds[0],
    confirmedRound: result.confirmedRound ?? 0,
    from: clawbackTarget || senderAddress,
    to: receiver,
    amount: amount.toString(),
    assetId,
    clawbackTarget,
    closeAssetTo,
  }
}

// ============================================================================
// asset_opt_in
// ============================================================================

export interface OptInAssetArgs {
  assetId: number
  sender?: string
}

export async function optInAsset(
  algorand: AlgorandClient,
  args: OptInAssetArgs,
  resolveSender: ResolveSenderFn
) {
  const { assetId, sender } = args

  validateRequiredId(assetId, 'assetId')

  const { address: senderAddress } = await resolveSender(algorand, sender)

  const result = await sendTransactions(
    { transactions: [{ type: 'asset_opt_in', assetId, sender }] },
    algorand,
    resolveSender
  )

  return {
    success: true,
    txId: result.txIds[0],
    confirmedRound: result.confirmedRound ?? 0,
    assetId,
    account: senderAddress,
  }
}

// ============================================================================
// asset_opt_out
// ============================================================================

export interface OptOutAssetArgs {
  assetId: number
  creator: string
  sender?: string
  ensureZeroBalance?: boolean
}

export async function optOutAsset(
  algorand: AlgorandClient,
  args: OptOutAssetArgs,
  resolveSender: ResolveSenderFn
) {
  const { assetId, creator, sender, ensureZeroBalance = true } = args

  validateRequiredId(assetId, 'assetId')
  validateRequiredAddress(creator, 'creator')

  const { address: senderAddress } = await resolveSender(algorand, sender)

  if (ensureZeroBalance) {
    const accountInfo = await algorand.account.getInformation(senderAddress)
    const assetHolding = accountInfo.assets?.find((a) => Number(a.assetId) === assetId)
    if (assetHolding && assetHolding.amount > 0) {
      throw new Error(
        `Account has non-zero balance (${assetHolding.amount}) of asset ${assetId}. ` +
          'Set ensureZeroBalance=false to opt out anyway and send balance to creator.'
      )
    }
  }

  const result = await sendTransactions(
    { transactions: [{ type: 'asset_opt_out', assetId, closeAssetTo: creator, sender }] },
    algorand,
    resolveSender
  )

  return {
    success: true,
    txId: result.txIds[0],
    confirmedRound: result.confirmedRound ?? 0,
    assetId,
    account: senderAddress,
    closedTo: creator,
  }
}

// ============================================================================
// asset_freeze
// ============================================================================

export interface FreezeAssetArgs {
  assetId: number
  account: string
  frozen: boolean
  sender?: string
}

export async function freezeAsset(
  algorand: AlgorandClient,
  args: FreezeAssetArgs,
  resolveSender: ResolveSenderFn
) {
  const { assetId, account, frozen, sender } = args

  validateRequiredId(assetId, 'assetId')
  validateRequiredAddress(account, 'account')
  validateRequiredBoolean(frozen, 'frozen')

  const result = await sendTransactions(
    {
      transactions: [
        { type: 'asset_freeze', assetId, freezeTarget: account, frozen, sender },
      ],
    },
    algorand,
    resolveSender
  )

  return {
    success: true,
    txId: result.txIds[0],
    confirmedRound: result.confirmedRound ?? 0,
    assetId,
    account,
    frozen,
  }
}

// ============================================================================
// asset_config
// ============================================================================

export interface ConfigAssetArgs {
  assetId: number
  manager?: string
  reserve?: string
  freeze?: string
  clawback?: string
  sender?: string
}

export async function configAsset(
  algorand: AlgorandClient,
  args: ConfigAssetArgs,
  resolveSender: ResolveSenderFn
) {
  const { assetId, manager, reserve, freeze, clawback, sender } = args

  validateRequiredId(assetId, 'assetId')
  validateOptionalAddress(manager, 'manager', true)
  validateOptionalAddress(reserve, 'reserve', true)
  validateOptionalAddress(freeze, 'freeze', true)
  validateOptionalAddress(clawback, 'clawback', true)

  const assetInfo = await algorand.asset.getById(BigInt(assetId))

  const result = await sendTransactions(
    {
      transactions: [
        {
          type: 'asset_config',
          assetId,
          manager: manager !== undefined ? manager || undefined : assetInfo.manager,
          reserve: reserve !== undefined ? reserve || undefined : assetInfo.reserve,
          freeze: freeze !== undefined ? freeze || undefined : assetInfo.freeze,
          clawback: clawback !== undefined ? clawback || undefined : assetInfo.clawback,
          sender,
        },
      ],
    },
    algorand,
    resolveSender
  )

  return {
    success: true,
    txId: result.txIds[0],
    confirmedRound: result.confirmedRound ?? 0,
    assetId,
  }
}

// ============================================================================
// asset_destroy
// ============================================================================

export interface DestroyAssetArgs {
  assetId: number
  sender?: string
}

export async function destroyAsset(
  algorand: AlgorandClient,
  args: DestroyAssetArgs,
  resolveSender: ResolveSenderFn
) {
  const { assetId, sender } = args

  validateRequiredId(assetId, 'assetId')

  const result = await sendTransactions(
    { transactions: [{ type: 'asset_destroy', assetId, sender }] },
    algorand,
    resolveSender
  )

  return {
    success: true,
    txId: result.txIds[0],
    confirmedRound: result.confirmedRound ?? 0,
    assetId,
  }
}

// ============================================================================
// get_asset_info (read handler, uses algod not indexer)
// ============================================================================

export interface GetAssetInfoArgs {
  assetId: number
}

export async function getAssetInfo(algorand: AlgorandClient, args: GetAssetInfoArgs) {
  const { assetId } = args

  validateRequiredId(assetId, 'assetId')

  const assetInfo = await algorand.asset.getById(BigInt(assetId))

  return {
    assetId,
    creator: assetInfo.creator,
    total: assetInfo.total.toString(),
    decimals: assetInfo.decimals,
    unitName: assetInfo.unitName,
    assetName: assetInfo.assetName,
    url: assetInfo.url,
    manager: assetInfo.manager,
    reserve: assetInfo.reserve,
    freeze: assetInfo.freeze,
    clawback: assetInfo.clawback,
    defaultFrozen: assetInfo.defaultFrozen ?? false,
  }
}
