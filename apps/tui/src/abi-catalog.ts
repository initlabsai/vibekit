/**
 * My Apps spec catalog: match deployed associations to local specs by name,
 * then decode recorded app calls onto stored results.
 */
import type { StructuredResult } from '@initlabs/vibekit-experience'
import {
  enrichTransactionsWithAbi,
  labelSelectors,
  type NormalizedAppSpec,
} from '@initlabs/vibekit-tools'

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

type ProgramData = {
  applicationId?: number
  analysis?: { selectors: string[] }
  methods?: Array<{ selector: string; name?: string; signature?: string }>
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
  if (record.toolName === 'get_application_program') {
    const program = record.data as ProgramData
    const spec = program.applicationId !== undefined ? catalog.get(program.applicationId) : undefined
    if (spec && program.analysis) program.methods = labelSelectors(program.analysis.selectors, spec.methods)
    return record
  }
  const data = record.data as AppCallData
  if (Array.isArray(data.transactions)) {
    enrichTransactionsWithAbi(data.transactions, catalog)
    return record
  }
  enrichTransactionsWithAbi([data], catalog)
  return record
}
