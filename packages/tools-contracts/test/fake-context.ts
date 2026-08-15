/**
 * Test fake for ToolContext: stub only the algod/indexer calls the handler
 * under test touches. Chainable query builders resolve via .do().
 */
import { resolveNetwork, type ToolContext } from '@initlabs/core'

/** A chainable query stub: every method returns the same proxy; .do() resolves `result`. */
export function chainable<T>(result: T): unknown {
  const proxy: unknown = new Proxy(
    {},
    {
      get(_obj, prop) {
        if (prop === 'do') return async () => result
        return () => proxy
      },
    },
  )
  return proxy
}

export function fakeContext(overrides: {
  algod?: Record<string, unknown>
  indexer?: Record<string, unknown>
  mode?: ToolContext['mode']
  services?: Record<string, unknown>
}): ToolContext {
  return {
    network: resolveNetwork('localnet'),
    servedNetworks: ['localnet'],
    defaultNetwork: 'localnet',
    algod: (overrides.algod ?? {}) as unknown as ToolContext['algod'],
    indexer: (overrides.indexer ?? {}) as unknown as ToolContext['indexer'],
    mode: overrides.mode ?? 'compose',
    services: overrides.services ?? {},
  }
}
