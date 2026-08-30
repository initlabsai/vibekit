import type { StructuredResult } from '../actions/index.js'
import type { EntityLookupHost } from './host.js'

/** Entity kinds a bare numeric identifier can resolve to. */
export type AmbiguousEntityKind = 'asset' | 'application' | 'block'

/** One successful concurrent match. */
export type { EntityLookupHost } from './host.js'

export interface EntityLookupMatch {
  entity: AmbiguousEntityKind
  record: StructuredResult
}

/** One failed concurrent candidate. */
export interface EntityLookupMiss {
  entity: AmbiguousEntityKind
  message: string
}

/** Result of querying asset, application, and block candidates for one numeric id. */
export interface AmbiguousEntityLookup {
  id: number
  matches: EntityLookupMatch[]
  misses: EntityLookupMiss[]
}

function missMessage(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason)
}

/**
 * Queries asset, application, and block candidates in parallel. Typed matches
 * become cards; misses stay visible so the user can see which domains had no
 * record for this id.
 */
export async function lookupAmbiguousEntity(
  host: EntityLookupHost,
  id: number,
): Promise<AmbiguousEntityLookup> {
  const jobs: Array<{ entity: AmbiguousEntityKind; run: () => Promise<StructuredResult> }> = [
    { entity: 'asset', run: () => host.lookupAsset(id) },
    { entity: 'application', run: () => host.lookupApplication(id) },
    { entity: 'block', run: () => host.lookupBlock(id) },
  ]
  const settled = await Promise.allSettled(jobs.map((job) => job.run()))
  const matches: EntityLookupMatch[] = []
  const misses: EntityLookupMiss[] = []
  for (const [index, result] of settled.entries()) {
    const entity = jobs[index]!.entity
    if (result.status === 'fulfilled') matches.push({ entity, record: result.value })
    else misses.push({ entity, message: missMessage(result.reason) })
  }
  return { id, matches, misses }
}
