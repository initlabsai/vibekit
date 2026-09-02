/** An asset as a public page. `/asset/<id>` is mainnet; `/asset/<network>/<id>` names the network. */
import type { Metadata } from 'next'

import { resolveAssetByKey } from '../../../src/entity-og'
import { EntityPage, entityMetadata } from '../../../src/entity-routes'

type Params = { params: Promise<{ ref: string[] }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  return entityMetadata('asset', (await params).ref, resolveAssetByKey)
}

export default async function Page({ params }: Params) {
  return EntityPage({ kind: 'asset', ref: (await params).ref, resolve: resolveAssetByKey })
}
