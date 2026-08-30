/** One transaction, from a `transaction.detail` result (lookup_transaction, a row of a list). */
import type { ViewData } from '@initlabs/vibekit/tools/views'

import { formatBaseUnits, formatMicroAlgos, formatRoundTime, shorten } from './format'

export type TransactionProps = { transaction: ViewData<'transaction.detail'>; className?: string }

/** What moved: ALGO, an asset amount, an app call, or the type. */
export function transactionHeadline(txn: ViewData<'transaction.detail'>): string {
  if (txn.paymentAmountMicroAlgos !== undefined) return `${formatMicroAlgos(txn.paymentAmountMicroAlgos)} ALGO`
  if (txn.assetAmount !== undefined && txn.assetId !== undefined) {
    const amount = txn.assetDecimals === undefined ? String(txn.assetAmount) : formatBaseUnits(txn.assetAmount, txn.assetDecimals)
    return `${amount} ${txn.assetUnitName ?? `asset ${txn.assetId}`}`
  }
  if (txn.applicationId !== undefined) return `${txn.methodName ?? txn.onCompletion ?? 'call'} · ${txn.applicationLabel ?? `app ${txn.applicationId}`}`
  return txn.type ?? 'transaction'
}

export function Transaction({ transaction: txn, className = '' }: TransactionProps) {
  const facts: Array<[string, string | undefined]> = [
    ['from', txn.sender],
    ['to', txn.receiver],
    ['fee', `${formatMicroAlgos(txn.feeMicroAlgos)} ALGO`],
    ['round', txn.confirmedRound === undefined ? undefined : String(txn.confirmedRound)],
    ['when', txn.roundTime === undefined ? undefined : formatRoundTime(txn.roundTime)],
    ['note', txn.note],
    ['rekey to', txn.rekeyTo],
    ['close to', txn.closeTo],
  ]
  return (
    <section className={`vk-card vk-transaction ${className}`} data-type={txn.type}>
      <header className="vk-kicker">{txn.type ?? 'transaction'}</header>
      <h3 className="vk-hero">{transactionHeadline(txn)}</h3>
      <dl className="vk-facts">
        {facts.map(([label, value]) =>
          value === undefined ? null : (
            <div key={label}>
              <dt>{label}</dt>
              <dd title={value}>{/^[A-Z2-7]{58}$/.test(value) ? shorten(value) : value}</dd>
            </div>
          ),
        )}
      </dl>
      {txn.id ? <footer className="vk-id" title={txn.id}>{shorten(txn.id, 16)}</footer> : null}
    </section>
  )
}
