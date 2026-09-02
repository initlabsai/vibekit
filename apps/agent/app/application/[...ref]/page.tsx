/** An application as a public page. `/application/<id>` is mainnet; `/application/<network>/<id>` names the network. */
import type { Metadata } from 'next'

import { resolveApplicationByKey } from '../../../src/entity-og'
import { EntityPage, entityMetadata } from '../../../src/entity-routes'

type Params = { params: Promise<{ ref: string[] }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  return entityMetadata('application', (await params).ref, resolveApplicationByKey)
}

export default async function Page({ params }: Params) {
  return EntityPage({
    kind: 'application',
    ref: (await params).ref,
    resolve: resolveApplicationByKey,
  })
}
