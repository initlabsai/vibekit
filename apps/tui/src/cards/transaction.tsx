import {
  formatBaseUnits,
  formatBlockTxnType,
  formatExplorerTime,
  formatMicroAlgos,
  formatOnCompletion,
  type TransactionDetailViewModel,
} from '@initlabs/vibekit-experience'

import { COLORS } from '../theme.js'
import {
  Chip,
  Fact,
  FooterNote,
  Frame,
  Header,
  Hero,
  innerWidth,
  Rule,
  Unavailable,
  type Tone,
} from '../ui.js'
import { algo, pageNotes } from './shared.js'

function assetUnits(
  amount: number | string | undefined,
  decimals?: number,
  unitName?: string,
): { value: string; unit?: string } | undefined {
  if (amount === undefined) return undefined
  const value = decimals === undefined ? String(amount) : formatBaseUnits(amount, decimals)
  return { value, unit: unitName }
}

export function TransactionCard({
  model,
  width,
}: {
  model: TransactionDetailViewModel | undefined
  width: number
}) {
  if (!model) return <Unavailable title="TRANSACTION" width={width} />
  const body = innerWidth(width)
  const payment = model.amountMicroAlgos === undefined
    ? undefined
    : { value: formatMicroAlgos(model.amountMicroAlgos), unit: 'ALGO' }
  const transfer = assetUnits(model.assetAmount, model.assetDecimals, model.assetUnitName)
  const hero = payment ?? transfer
  const tone: Tone = model.status === 'confirmed' ? 'ok' : model.status === 'failed' ? 'bad' : 'warn'
  const assetLabel =
    model.assetId === undefined
      ? undefined
      : model.assetName
        ? `${model.assetId} · ${model.assetName}`
        : String(model.assetId)
  return (
    <Frame width={width}>
      <Header
        kicker="TRANSACTION"
        chip={formatBlockTxnType(model.type)}
        pill={model.status.toUpperCase()}
        tone={tone}
      />
      {hero ? <Hero value={hero.value} unit={hero.unit} /> : null}
      <box marginTop={1} flexDirection="column">
        <Rule width={body} />
        <Fact label="id" value={model.id} copy={model.id} width={body} />
        {model.roundTime === undefined ? null : (
          <Fact label="time" value={formatExplorerTime(model.roundTime)} width={body} />
        )}
        {model.confirmedRound === undefined ? null : (
          <Fact
            label="block"
            value={String(model.confirmedRound)}
            copy={String(model.confirmedRound)}
            width={body}
          />
        )}
        <Fact label="fee" value={algo(model.feeMicroAlgos) ?? '—'} width={body} />
        <Fact label="from" value={model.sender} copy={model.sender} width={body} />
        {model.clawbackFrom ? (
          <Fact label="clawback" value={model.clawbackFrom} copy={model.clawbackFrom} width={body} />
        ) : null}
        {model.receiver ? (
          <Fact label="to" value={model.receiver} copy={model.receiver} width={body} />
        ) : null}
        {assetLabel && model.assetId !== undefined ? (
          <Fact label="asset" value={assetLabel} copy={String(model.assetId)} width={body} />
        ) : null}
        {model.applicationId === undefined ? null : (
          <Fact
            label="app"
            value={String(model.applicationId)}
            copy={String(model.applicationId)}
            width={body}
          />
        )}
        {model.onCompletion ? (
          <Fact label="on-comp" value={formatOnCompletion(model.onCompletion)} width={body} />
        ) : null}
        {model.closeTo ? (
          <Fact label="close" value={model.closeTo} copy={model.closeTo} width={body} />
        ) : null}
        {model.closeAmountMicroAlgos === undefined ? null : (
          <Fact label="closed" value={algo(model.closeAmountMicroAlgos) ?? '—'} width={body} />
        )}
        {model.closeAssetAmount === undefined ? null : (
          <Fact
            label="closed"
            value={
              assetUnits(model.closeAssetAmount, model.assetDecimals, model.assetUnitName)?.value ??
              String(model.closeAssetAmount)
            }
            width={body}
          />
        )}
        {model.rekeyTo ? (
          <Fact label="rekey" value={model.rekeyTo} copy={model.rekeyTo} width={body} />
        ) : null}
        {model.group ? (
          <Fact label="group" value={model.group} copy={model.group} width={body} />
        ) : null}
        {model.innerCount ? <Fact label="inner" value={`+${model.innerCount}`} width={body} /> : null}
        {model.note ? <Fact label="note" value={model.note} width={body} /> : null}
        <Fact label="network" value={model.network} width={body} />
      </box>
    </Frame>
  )
}

export function TransactionListCard({
  title,
  groupId,
  transactions,
  nextToken,
  width,
}: {
  title: string
  groupId?: string
  transactions: ReadonlyArray<{
    id?: string
    type?: string
    sender: string
    receiver?: string
    paymentAmountMicroAlgos?: number | string
    feeMicroAlgos?: number | string
    assetId?: number | string
    assetAmount?: number | string
    applicationId?: number | string
    confirmedRound?: number
    roundTime?: number
    innerCount?: number
  }>
  nextToken?: string
  width: number
}) {
  const body = innerWidth(width)
  const rows = transactions.slice(0, 10)
  return (
    <Frame width={width}>
      <Header kicker={title} pill={String(transactions.length)} tone="idle" />
      {groupId ? <Fact label="group" value={groupId} copy={groupId} width={body} /> : null}
      <box flexDirection="column">
        {rows.map((row, index) => {
          const payment = algo(row.paymentAmountMicroAlgos)
          const asset =
            row.assetAmount === undefined
              ? undefined
              : `${row.assetAmount}${row.assetId === undefined ? '' : ` #${row.assetId}`}`
          const amount = payment ?? asset
          const to =
            row.receiver ??
            (row.applicationId === undefined ? undefined : `app ${row.applicationId}`)
          return (
            <box key={row.id ?? `${row.sender}-${index}`} flexDirection="column" marginTop={1}>
              <box flexDirection="row" height={1}>
                <Chip label={formatBlockTxnType(row.type ?? 'txn')} />
                {amount ? <text fg={COLORS.brassBright}>{`  ${amount}`}</text> : null}
              </box>
              <Fact label="from" value={row.sender} copy={row.sender} width={body} />
              {to ? (
                <Fact
                  label="to"
                  value={to}
                  copy={row.receiver ?? (row.applicationId === undefined ? undefined : String(row.applicationId))}
                  width={body}
                />
              ) : null}
              {row.id ? <Fact label="id" value={row.id} copy={row.id} width={body} /> : null}
              {row.confirmedRound === undefined ? null : (
                <Fact
                  label="round"
                  value={String(row.confirmedRound)}
                  copy={String(row.confirmedRound)}
                  width={body}
                />
              )}
              {row.roundTime === undefined ? null : (
                <Fact label="time" value={formatExplorerTime(row.roundTime)} width={body} />
              )}
              {row.feeMicroAlgos === undefined ? null : (
                <Fact label="fee" value={algo(row.feeMicroAlgos) ?? '—'} width={body} />
              )}
              {row.innerCount ? (
                <Fact label="inner" value={`+${row.innerCount}`} width={body} />
              ) : null}
              {index < rows.length - 1 ? <Rule width={body} /> : null}
            </box>
          )
        })}
        {pageNotes(transactions.length, rows.length, nextToken).map((note) => (
          <FooterNote key={note} text={note} width={body} />
        ))}
      </box>
    </Frame>
  )
}
