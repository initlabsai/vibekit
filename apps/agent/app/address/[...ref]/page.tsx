/** An account as a public page. `/address/<addr>` is mainnet; `/address/<network>/<addr>` names the network. */
import type { Metadata } from 'next'

import { resolveAddressByKey } from '../../../src/entity-og'
import { EntityPage, entityMetadata } from '../../../src/entity-routes'

type Params = { params: Promise<{ ref: string[] }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  return entityMetadata('address', (await params).ref, resolveAddressByKey)
}

export default async function Page({ params }: Params) {
  return EntityPage({ kind: 'address', ref: (await params).ref, resolve: resolveAddressByKey })
}
