/**
 * An NFD name as a public page: forward-resolve, then the address card.
 * `/nfd/gabe.algo` is mainnet; `/nfd/testnet/gabe.algo` names the network;
 * a bare label means the .algo name.
 */
import type { Metadata } from 'next'

import { resolveNfdByKey } from '../../../src/entity-og'
import { EntityPage, entityMetadata } from '../../../src/entity-routes'

type Params = { params: Promise<{ ref: string[] }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  return entityMetadata('nfd', (await params).ref, resolveNfdByKey)
}

export default async function Page({ params }: Params) {
  return EntityPage({ kind: 'nfd', ref: (await params).ref, resolve: resolveNfdByKey })
}
