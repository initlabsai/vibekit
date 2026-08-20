import {
  formatMicroAlgos,
  type AccountPortfolioViewModel,
  type PaymentFlowViewModel,
  type TransactionDetailViewModel,
} from '@initlabs/vibekit-experience'

import { COLORS, shorten } from './theme.js'

export function Card({
  title,
  badge,
  badgeColor,
  lines,
  width,
}: {
  title: string
  badge?: string
  badgeColor?: string
  lines: string[]
  width: number
}) {
  return (
    <box
      width={width}
      flexDirection="column"
      border
      borderStyle="single"
      borderColor={COLORS.border}
      paddingX={1}
      backgroundColor={COLORS.panel}
      marginTop={1}
    >
      <box flexDirection="row" justifyContent="space-between">
        <text fg={COLORS.brassBright}>{title}</text>
        {badge ? <text fg={badgeColor ?? COLORS.green}>{badge}</text> : null}
      </box>
      <text fg={COLORS.text} content={lines.map((line) => shorten(line, width - 4)).join('\n')} />
    </box>
  )
}

export function TransactionCard({
  model,
  width,
}: {
  model: TransactionDetailViewModel | undefined
  width: number
}) {
  if (!model) {
    return (
      <Card
        title="TRANSACTION"
        badge="UNAVAILABLE"
        badgeColor={COLORS.red}
        lines={['The record could not be derived.']}
        width={width}
      />
    )
  }
  return (
    <Card
      title="TRANSACTION"
      badge={model.status.toUpperCase()}
      badgeColor={model.status === 'confirmed' ? COLORS.green : COLORS.brass}
      lines={[
        model.id,
        `${model.type} · ${model.network}${model.confirmedRound === undefined ? '' : ` · round ${model.confirmedRound}`}`,
        `from  ${model.sender}`,
        `to    ${model.receiver ?? '—'}`,
        `${model.amountMicroAlgos === undefined ? '—' : formatMicroAlgos(model.amountMicroAlgos)} ALGO · fee ${formatMicroAlgos(model.feeMicroAlgos)} ALGO`,
      ]}
      width={width}
    />
  )
}

/** How an account card's asset rows are ordered; cycled with the `s` key. */
export type AssetSort = 'none' | 'amount-desc' | 'amount-asc' | 'id-asc'

export const ASSET_SORT_LABEL: Record<AssetSort, string> = {
  none: '',
  'amount-desc': 'amount ↓',
  'amount-asc': 'amount ↑',
  'id-asc': 'asset id ↑',
}

export function nextAssetSort(sort: AssetSort): AssetSort {
  const cycle: AssetSort[] = ['none', 'amount-desc', 'amount-asc', 'id-asc']
  return cycle[(cycle.indexOf(sort) + 1) % cycle.length]!
}

function sortedAssets(assets: AccountPortfolioViewModel['assets'], sort: AssetSort) {
  if (sort === 'none') return assets
  const big = (value: number | string) => BigInt(value)
  const compare = (a: bigint, b: bigint) => (a < b ? -1 : a > b ? 1 : 0)
  const copy = [...assets]
  if (sort === 'id-asc') copy.sort((a, b) => compare(big(a.assetId), big(b.assetId)))
  else {
    copy.sort((a, b) => {
      const ascending = compare(big(a.amount), big(b.amount))
      return sort === 'amount-asc' ? ascending : -ascending
    })
  }
  return copy
}

export function AccountCard({
  model,
  width,
  sort = 'none',
  maxAssets = 4,
}: {
  model: AccountPortfolioViewModel | undefined
  width: number
  sort?: AssetSort
  maxAssets?: number
}) {
  if (!model) {
    return (
      <Card
        title="ACCOUNT"
        badge="UNAVAILABLE"
        badgeColor={COLORS.red}
        lines={['The record could not be derived.']}
        width={width}
      />
    )
  }
  const ordered = sortedAssets(model.assets, sort)
  const assets =
    ordered.length === 0
      ? ['no assets']
      : ordered
          .slice(0, maxAssets)
          .map(
            (asset) =>
              `asset ${asset.assetId} · ${asset.name ?? '—'} · ${asset.amount}${asset.unitName ? ` ${asset.unitName}` : ''}`,
          )
  const more = ordered.length > maxAssets ? [`… ${ordered.length - maxAssets} more assets`] : []
  const sortNote = sort === 'none' ? [] : [`sorted by ${ASSET_SORT_LABEL[sort]}`]
  return (
    <Card
      title="ACCOUNT"
      badge={model.network.toUpperCase()}
      lines={[
        model.address,
        `${formatMicroAlgos(model.balanceMicroAlgos)} ALGO`,
        ...assets,
        ...more,
        ...sortNote,
      ]}
      width={width}
    />
  )
}

export function paymentLines(model: PaymentFlowViewModel): string[] {
  const lines = [
    `${formatMicroAlgos(model.amountMicroAlgos)} ALGO · ${model.network}`,
    `from  ${model.sender}`,
    `to    ${model.receiver}`,
  ]
  if (model.simulation) {
    lines.push(
      `${model.simulation.wouldSucceed ? 'would succeed' : 'WOULD FAIL'} · fee ${formatMicroAlgos(model.simulation.feeMicroAlgos)} ALGO${model.simulation.simulatedRound === undefined ? '' : ` · round ${model.simulation.simulatedRound}`}`,
    )
    if (model.simulation.failureMessage) lines.push(`why: ${model.simulation.failureMessage}`)
    for (const effect of model.simulation.effects) {
      const delta = formatMicroAlgos(effect.deltaMicroAlgos)
      const signed = delta.startsWith('-') || delta === '0' ? delta : `+${delta}`
      lines.push(`  ${effect.role.padEnd(8)} ${signed} ALGO`)
    }
  }
  if (model.approval && model.approval.state !== 'pending') {
    lines.push(
      `approval: ${model.approval.state}${model.approval.reason ? ` · ${model.approval.reason}` : ''}`,
    )
  }
  if (model.signed) lines.push(`signed by keystore · ${model.signed.txIds[0]!}`)
  if (model.confirmation) {
    lines.push(
      `confirmed · round ${model.confirmation.confirmedRound} · ${model.confirmation.transactionId}`,
    )
  }
  return lines
}

export function PaymentCard({
  model,
  stage,
  busy,
  width,
}: {
  model: PaymentFlowViewModel | undefined
  stage: string
  busy: boolean
  width: number
}) {
  if (!model) {
    return (
      <Card
        title="PAYMENT"
        badge="UNAVAILABLE"
        badgeColor={COLORS.red}
        lines={['The record could not be derived.']}
        width={width}
      />
    )
  }
  const failed = model.simulation?.wouldSucceed === false
  const badge = busy
    ? 'WORKING…'
    : stage === 'awaiting-approval'
      ? failed
        ? 'SIMULATION FAILED'
        : 'AWAITING APPROVAL'
      : stage === 'confirmed'
        ? 'CONFIRMED'
        : stage === 'denied'
          ? 'DENIED'
          : stage.toUpperCase()
  const badgeColor =
    stage === 'denied' || failed ? COLORS.red : stage === 'confirmed' ? COLORS.green : COLORS.brass
  return (
    <Card
      title="PAYMENT"
      badge={badge}
      badgeColor={badgeColor}
      lines={paymentLines(model)}
      width={width}
    />
  )
}
