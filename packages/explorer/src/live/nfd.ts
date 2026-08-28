/**
 * NFD name resolution for hosts that run on Node: the nfd plugin's own
 * client and record shape, on mainnet or testnet. The live host itself
 * carries no plugins; a host that offers names calls this beside it.
 */
import { nfdPlugin, nfdRecord, type NfdRecord, type NfdService } from '@initlabs/vibekit/plugins/nfd'

import type { LiveNetworkId } from '../host.js'

let service: NfdService | undefined

/** Resolves `alice.algo` (or a bare label) to its NFD record; throws off mainnet/testnet. */
export async function resolveNfdName(network: LiveNetworkId, name: string): Promise<NfdRecord> {
  if (network !== 'mainnet' && network !== 'testnet') {
    throw new Error(`NFD names resolve on mainnet and testnet only — not ${network}`)
  }
  const lower = name.toLowerCase().trim()
  const full = lower.includes('.') ? lower : `${lower}.algo`
  // The plugin's service is its client cache; built once per process.
  service ??= nfdPlugin().service as NfdService
  try {
    const nfd = await service.clientFor(network).resolve(full, { view: 'full' })
    return nfdRecord(nfd, full)
  } catch (error: unknown) {
    // The NFD SDK rejects with a plain { name, message } object, not an Error.
    if (error instanceof Error) throw error
    const { message } = (error ?? {}) as { message?: string }
    throw new Error(message ? `NFD: ${message}` : `NFD could not resolve ${full}`)
  }
}

export { nfdRecordSchema, type NfdRecord } from '@initlabs/vibekit/plugins/nfd'
