/**
 * My Apps spec catalog: match deployed associations to local specs by name,
 * then decode recorded app calls onto stored results.
 */
import type { StructuredResult } from '@initlabs/vibekit/views'
import { base64ToBytes } from '@initlabs/vibekit'
import {
  enrichTransactionsWithAbi,
  labelSelectors,
  programHash,
  type NormalizedAppSpec,
} from '@initlabs/vibekit/tools'

/** Deployed appId → local spec, matching on contract name. */
export function specCatalog(
  deployed: ReadonlyArray<{ name: string; appId: number }>,
  localSpecs: ReadonlyArray<{ spec: NormalizedAppSpec }>,
): Map<number, NormalizedAppSpec> {
  const byName = new Map<string, NormalizedAppSpec>()
  for (const local of localSpecs) {
    if (!byName.has(local.spec.name)) byName.set(local.spec.name, local.spec)
  }
  const catalog = new Map<number, NormalizedAppSpec>()
  for (const entry of deployed) {
    const spec = byName.get(entry.name)
    if (spec) catalog.set(entry.appId, spec)
  }
  return catalog
}

/**
 * Local specs by the hash of their compiled approval program. A program
 * record carrying the same hash proves the spec is this app's — no deploy
 * record or name match needed. Template-variable contracts won't match.
 */
export function specsByProgramHash(
  localSpecs: ReadonlyArray<{ spec: NormalizedAppSpec }>,
): Map<string, NormalizedAppSpec> {
  const byHash = new Map<string, NormalizedAppSpec>()
  for (const { spec } of localSpecs) {
    const approval = spec.byteCode?.approval
    if (!approval) continue
    try {
      const hash = programHash(base64ToBytes(approval))
      if (!byHash.has(hash)) byHash.set(hash, spec)
    } catch {
      // Malformed byteCode: the spec still serves by name.
    }
  }
  return byHash
}

export type ProgramData = {
  applicationId?: number
  programHash?: string
  analysis?: { selectors: string[] }
  methods?: Array<{ selector: string; name?: string; signature?: string }>
}

/**
 * A program's methods with spec names and args when a spec is known — by
 * deploy record first, then by compiled-program hash. Runs inside the tool
 * call so the model reads the names too, not just the card.
 */
export function labelProgramMethods(
  program: ProgramData,
  catalog: ReadonlyMap<number, NormalizedAppSpec>,
  byProgramHash: ReadonlyMap<string, NormalizedAppSpec>,
): ProgramData['methods'] {
  const spec =
    (program.applicationId !== undefined ? catalog.get(program.applicationId) : undefined) ??
    (program.programHash !== undefined ? byProgramHash.get(program.programHash) : undefined)
  if (!spec || !program.analysis) return program.methods
  return labelSelectors(program.analysis.selectors, spec.methods)
}

type AppCallData = {
  applicationId?: number
  applicationArgs?: string[]
  logs?: string[]
  methodName?: string
  methodArgs?: Array<{ name?: string; type: string; value?: unknown }>
  methodReturn?: unknown
  innerTxns?: AppCallData[]
  transactions?: AppCallData[]
}

/** Mutates success-record data in place: fills methodName/args/return where a spec is known. */
export function enrichResultWithAbi(
  record: StructuredResult,
  catalog: ReadonlyMap<number, NormalizedAppSpec>,
): StructuredResult {
  if (record.state !== 'success' || catalog.size === 0) return record
  const data = record.data as AppCallData
  if (Array.isArray(data.transactions)) {
    enrichTransactionsWithAbi(data.transactions, catalog)
    return record
  }
  enrichTransactionsWithAbi([data], catalog)
  return record
}
