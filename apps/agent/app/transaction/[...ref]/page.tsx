/**
 * A transaction as a public page — the bot's confirmation link. `/transaction/<txid>`
 * is mainnet; `/transaction/<network>/<txid>` names the network.
 */
import type { Metadata } from 'next'

import { resolveTransactionByKey } from '../../../src/entity-og'
import { EntityPage, entityMetadata } from '../../../src/entity-routes'

type Params = { params: Promise<{ ref: string[] }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  return entityMetadata('transaction', (await params).ref, resolveTransactionByKey)
}

export default async function Page({ params }: Params) {
  return EntityPage({
    kind: 'transaction',
    ref: (await params).ref,
    resolve: resolveTransactionByKey,
  })
}
