import { afterEach, describe, expect, test } from 'bun:test'

import {
  createFixtureResultStore,
  FIXTURE_SENDER,
  FIXTURE_TRANSACTION_ID,
} from '@initlabs/vibekit-explorer'

import { createRemoteExplorerHost } from './remote-host.js'

const originalFetch = globalThis.fetch
afterEach(() => {
  globalThis.fetch = originalFetch
})

function stubFetch(reply: (body: Record<string, unknown>) => unknown, status = 200) {
  const bodies: Record<string, unknown>[] = []
  globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>
    bodies.push(body)
    return new Response(JSON.stringify(reply(body)), { status })
  }) as typeof fetch
  return bodies
}

const fixtureRecord = createFixtureResultStore()[0]!

describe('remote explorer host', () => {
  test('every request body carries the network', async () => {
    const bodies = stubFetch(() => ({ record: fixtureRecord, live: true, lastRound: 7 }))
    const host = createRemoteExplorerHost({ network: 'mainnet' })
    await host.lookupAccount(FIXTURE_SENDER)
    await host.lookupTransaction(FIXTURE_TRANSACTION_ID)
    await host.searchTransactions({ address: FIXTURE_SENDER })
    await host.callTool('lookup_asset', { assetId: 1 })
    await host.draftPayment({ sender: 'a', receiver: 'b', amountMicroAlgos: 1 })
    await host.probe()
    await host.statusRound()
    expect(bodies.length).toBe(7)
    for (const body of bodies) expect(body.network).toBe('mainnet')
    expect(bodies[3]).toEqual({
      action: 'call-tool',
      network: 'mainnet',
      toolName: 'lookup_asset',
      args: { assetId: 1 },
    })
  })

  test('resolveName carries the network and validates the profile', async () => {
    const bodies = stubFetch(() => ({ nfd: { name: 'alice.algo', address: FIXTURE_SENDER } }))
    const host = createRemoteExplorerHost({ network: 'testnet' })
    expect(await host.resolveName('alice.algo')).toEqual({ name: 'alice.algo', address: FIXTURE_SENDER })
    expect(bodies[0]).toEqual({ action: 'resolve-nfd', network: 'testnet', name: 'alice.algo' })
  })

  test('records are parsed against the protocol schema before use', async () => {
    stubFetch(() => ({ record: { nonsense: true } }))
    const host = createRemoteExplorerHost({ network: 'localnet' })
    await expect(host.lookupAccount(FIXTURE_SENDER)).rejects.toThrow()
  })

  test('a failed response surfaces the server message', async () => {
    stubFetch(() => ({ error: 'This host has no tool named nope' }), 400)
    const host = createRemoteExplorerHost({ network: 'localnet' })
    await expect(host.callTool('nope', {})).rejects.toThrow('no tool named nope')
  })

  test('has no signer unless one is injected', () => {
    expect(createRemoteExplorerHost({ network: 'localnet' }).signDraft).toBeUndefined()
    const signDraft = async () => fixtureRecord
    expect(createRemoteExplorerHost({ network: 'localnet', signDraft }).signDraft).toBeDefined()
  })
})
