/**
 * The entity posters: `/og/<kind>/<ref…>` renders the 1200×630 card the
 * entity pages name as their og:image. One handler for every kind — the
 * opengraph-image file convention can't live inside a catch-all segment.
 * Each response carries the cache-control its resolution earned.
 */
import {
  resolveApplicationByKey,
  resolveAssetByKey,
  resolveBlockByKey,
  resolveTransactionByKey,
} from '../../../src/entity-og'
import { entityImage, type EntityKind, type Resolver } from '../../../src/entity-routes'

export const runtime = 'nodejs'
export const maxDuration = 15

const RESOLVERS: Record<EntityKind, Resolver> = {
  transaction: resolveTransactionByKey,
  asset: resolveAssetByKey,
  application: resolveApplicationByKey,
  block: resolveBlockByKey,
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  const [kind, ...ref] = (await params).path
  const resolve = kind && kind in RESOLVERS ? RESOLVERS[kind as EntityKind] : undefined
  if (!resolve) return new Response('Not found', { status: 404 })
  return entityImage(kind as EntityKind, ref, resolve)
}
