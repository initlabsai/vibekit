/**
 * A transaction group as a public page. `/group/<id>` is mainnet;
 * `/group/<network>/<id>` names the network. The id is base64url (plain
 * base64 also accepted) — a raw group id's `/` cannot ride in a path.
 */
import type { Metadata } from 'next'

import { resolveGroupByKey } from '../../../src/entity-og'
import { EntityPage, entityMetadata } from '../../../src/entity-routes'

type Params = { params: Promise<{ ref: string[] }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  return entityMetadata('group', (await params).ref, resolveGroupByKey)
}

export default async function Page({ params }: Params) {
  return EntityPage({ kind: 'group', ref: (await params).ref, resolve: resolveGroupByKey })
}
