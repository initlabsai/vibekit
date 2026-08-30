/** An account from an `account.summary` result (lookup_account). */
import type { ViewData } from '@initlabs/vibekit/tools/views'

import { formatMicroAlgos, shorten } from './format'

export type AccountProps = { account: ViewData<'account.summary'>; className?: string }

export function Account({ account, className = '' }: AccountProps) {
  const count = (n: number | undefined, noun: string) => (n === undefined ? undefined : `${n} ${noun}${n === 1 ? '' : 's'}`)
  const facts: Array<[string, string | undefined]> = [
    ['min balance', account.minBalanceMicroAlgos === undefined ? undefined : `${formatMicroAlgos(account.minBalanceMicroAlgos)} ALGO`],
    ['assets', count(account.totalAssetsOptedIn, 'holding')],
    ['apps', count(account.totalAppsOptedIn, 'opt-in')],
    ['created', [count(account.totalCreatedAssets, 'asset'), count(account.totalCreatedApps, 'app')].filter(Boolean).join(', ') || undefined],
    ['status', account.status],
    ['rekeyed to', account.rekeyedTo],
    ['since round', account.createdAtRound === undefined ? undefined : String(account.createdAtRound)],
  ]
  return (
    <section className={`vk-card vk-account${account.rekeyedTo ? ' vk-account-rekeyed' : ''} ${className}`} data-address={account.address}>
      <header className="vk-kicker" title={account.address}>{shorten(account.address, 16)}</header>
      <h3 className="vk-hero">{formatMicroAlgos(account.balanceMicroAlgos)} ALGO</h3>
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
    </section>
  )
}
