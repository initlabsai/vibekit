/** A block as a public page. `/block/<round>` is mainnet; `/block/<network>/<round>` names the network. */
import type { Metadata } from 'next'

import { resolveBlockByKey } from '../../../src/entity-og'
import { EntityPage, entityMetadata } from '../../../src/entity-routes'

type Params = { params: Promise<{ ref: string[] }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  return entityMetadata('block', (await params).ref, resolveBlockByKey)
}

export default async function Page({ params }: Params) {
  return EntityPage({ kind: 'block', ref: (await params).ref, resolve: resolveBlockByKey })
}
