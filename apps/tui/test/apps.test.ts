import { describe, expect, test } from 'bun:test'
import type { StructuredResult } from '@initlabs/vibekit/views'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { specCatalog } from '../src/features/apps/abi-catalog.js'
import {
  appGroups,
  deployedFromRecord,
  isAppSpecCandidate,
  mergeDeployed,
  optedInFromRecord,
  scanAppSpecs,
} from '../src/features/apps/hooks.js'

const arc56 = JSON.stringify({
  arcs: [22],
  name: 'Counter',
  methods: [{ name: 'add', args: [{ type: 'uint64' }], returns: { type: 'uint64' } }],
  state: { schema: { global: { ints: 1, bytes: 0 }, local: { ints: 0, bytes: 0 } } },
})

const arc32 = JSON.stringify({
  contract: { name: 'Vault', methods: [{ name: 'go', args: [], returns: { type: 'void' } }] },
  state: { global: { num_uints: 2, num_byte_slices: 0 } },
})

const arc4 = JSON.stringify({
  name: 'Greeter',
  methods: [{ name: 'hello', args: [{ type: 'string' }], returns: { type: 'string' } }],
})

function tree(): string {
  const root = mkdtempSync(join(tmpdir(), 'vibekit-apps-scan-'))
  const write = (relative: string, content: string) => {
    const path = join(root, relative)
    mkdirSync(join(path, '..'), { recursive: true })
    writeFileSync(path, content)
  }
  write('counter.arc56.json', arc56)
  write('smart_contracts/artifacts/application.json', arc32)
  write('artifacts/Counter.arc32.json', arc32.replace('Vault', 'Counter')) // same name as the ARC-56
  write('contracts/greeter.json', arc4) // any *.json counts inside an output dir
  write('contracts/tsconfig.json', '{"compilerOptions":{}}') // valid JSON, not a spec
  write('vault.arc32.json', 'not json at all') // candidate name, invalid JSON
  write('deep/a/b/c/d/nested.arc56.json', arc56) // beyond depth 4
  write('node_modules/pkg/app.arc56.json', arc56) // skipped dir
  write('.git/app.arc56.json', arc56) // dot-dir
  write('notes.json', arc56) // spec content but non-candidate name outside output dirs
  return root
}

describe('app spec discovery scan', () => {
  test('candidate rules: known names anywhere, any json under output dirs', () => {
    expect(isAppSpecCandidate('x.arc56.json', [])).toBe(true)
    expect(isAppSpecCandidate('x.arc32.json', ['src'])).toBe(true)
    expect(isAppSpecCandidate('x.appspec.json', [])).toBe(true)
    expect(isAppSpecCandidate('application.json', [])).toBe(true)
    expect(isAppSpecCandidate('anything.json', ['smart_contracts'])).toBe(true)
    expect(isAppSpecCandidate('anything.json', ['out', 'artifacts'])).toBe(true)
    expect(isAppSpecCandidate('anything.json', ['src'])).toBe(false)
    expect(isAppSpecCandidate('x.arc56.txt', [])).toBe(false)
  })

  test('scan validates candidates, skips junk, respects depth and skip dirs', () => {
    const results = scanAppSpecs(tree())
    // ARC-56 first so a name present in several formats resolves to the richest spec.
    expect(results.map((entry) => entry.path)).toEqual([
      'counter.arc56.json',
      'artifacts/Counter.arc32.json',
      'contracts/greeter.json',
      'smart_contracts/artifacts/application.json',
    ])
    const byPath = Object.fromEntries(results.map((entry) => [entry.path, entry.spec]))
    expect(byPath['counter.arc56.json']?.format).toBe('arc56')
    expect(byPath['counter.arc56.json']?.schema.globalInts).toBe(1)
    expect(byPath['smart_contracts/artifacts/application.json']?.format).toBe('arc32')
    expect(byPath['contracts/greeter.json']?.format).toBe('arc4')
    expect(byPath['contracts/greeter.json']?.methods[0]?.signature).toBe('hello(string)string')
  })

  test('unreadable root scans as empty', () => {
    expect(scanAppSpecs('/nonexistent/vibekit-scan-root')).toEqual([])
  })
})

describe('apps screen entries', () => {
  test('appGroups merges by name: deployed first (newest first), then opted-in, then spec-only', () => {
    const local = scanAppSpecs(tree())
    const counter = local.filter((entry) => entry.spec.name === 'Counter')
    const groups = appGroups(
      [
        { name: 'Counter', appId: 1042 },
        { name: 'Counter', appId: 1050 },
      ],
      [{ appId: 1071, name: 'Sample' }, { appId: 1042 }],
      local,
    )
    expect(groups.map((g) => g.name)).toEqual(['Counter', 'Sample', 'app 1042', 'Greeter', 'Vault'])
    expect(groups[0]).toMatchObject({
      deployed: [{ appId: 1050 }, { appId: 1042 }],
      optedIn: [],
      specs: counter,
    })
    expect(groups[0]?.spec?.spec.format).toBe('arc56') // richest spec first
    expect(groups[1]).toMatchObject({ deployed: [], optedIn: [1071], specs: [] })
    expect(groups[3]?.spec?.path).toBe('contracts/greeter.json')
  })

  test('deployedFromRecord reads AlgoKit deployer notes off app-create rows', () => {
    const record = (transactions: unknown): StructuredResult =>
      ({
        protocolVersion: '0.1.0',
        type: 'result',
        resultId: 'r',
        state: 'success',
        data: { transactions },
      }) as never
    expect(
      deployedFromRecord(
        record([
          {
            note: 'ALGOKIT_DEPLOYER:j{"name":"HelloWorld","version":"1.0"}',
            createdApplicationId: 1007,
            sender: 'CREATOR',
          },
          {
            note: 'ALGOKIT_DEPLOYER:j{"name":"HelloWorld","version":"1.0"}',
            createdApplicationId: '1003',
          },
          { note: 'ALGOKIT_DEPLOYER:j{"name":"Other"}' }, // no created app: an update, not a create
          { note: 'ALGOKIT_DEPLOYER:jnot json', createdApplicationId: 9 },
          { note: 'hello', createdApplicationId: 10 },
          null,
        ]),
      ),
    ).toEqual([
      { name: 'HelloWorld', appId: 1007, creator: 'CREATOR' },
      { name: 'HelloWorld', appId: 1003 },
    ])
    expect(deployedFromRecord(record('junk'))).toEqual([])
    expect(deployedFromRecord({ ...record([]), state: 'error' } as StructuredResult)).toEqual([])
  })

  test('mergeDeployed dedupes by app id and puts the newest deployment first', () => {
    expect(
      mergeDeployed(
        [{ name: 'Stored', appId: 1003 }],
        [
          { name: 'HelloWorld', appId: 1003 },
          { name: 'HelloWorld', appId: 1007 },
        ],
      ),
    ).toEqual([
      { name: 'HelloWorld', appId: 1007 },
      { name: 'Stored', appId: 1003 },
    ])
  })

  test('optedInFromRecord reads application.locals app ids and ignores junk', () => {
    expect(
      optedInFromRecord({
        protocolVersion: '0.1.0',
        type: 'result',
        resultId: 'r',
        toolCallId: 't',
        toolName: 'get_account_app_local_states',
        network: 'localnet',
        state: 'success',
        data: {
          address: 'X',
          apps: [{ applicationId: 1071 }, { applicationId: 0 }, { nope: true }],
        },
      }),
    ).toEqual([{ appId: 1071 }])
    expect(
      optedInFromRecord({
        protocolVersion: '0.1.0',
        type: 'result',
        resultId: 'r',
        toolCallId: 't',
        toolName: 'get_account_app_local_states',
        network: 'localnet',
        state: 'error',
        error: { code: 'X', message: 'no' },
      }),
    ).toEqual([])
  })
})

describe('spec catalog', () => {
  test('binds a deployed app id to the local spec of the same name', () => {
    const local = scanAppSpecs(tree())
    const catalog = specCatalog([{ name: 'Counter', appId: 1042 }], local)
    expect(catalog.get(1042)?.name).toBe('Counter')
    expect(catalog.get(99)).toBeUndefined()
  })
})

describe('call summary on the approval card', () => {
  test('splits describeCall output into call, app, and one row per argument', async () => {
    const { parseCallSummary } = await import('../src/features/action/cards.js')
    expect(
      parseCallSummary(
        'HiWorld.hi(name: "a, b", n: 5, list: [1,2], t: {"type":"pay","amount":1}) → app 1018',
      ),
    ).toEqual({
      call: 'HiWorld.hi',
      appId: '1018',
      args: [
        { name: 'name', value: '"a, b"' },
        { name: 'n', value: '5' },
        { name: 'list', value: '[1,2]' },
        { name: 't', value: '{"type":"pay","amount":1}' },
      ],
    })
    expect(parseCallSummary('HiWorld.ping() → app 1')).toEqual({
      call: 'HiWorld.ping',
      appId: '1',
      args: [],
    })
    expect(parseCallSummary('[0] app call app 1018 (hi(string)string)')).toBeUndefined()
  })
})

describe('min-balance hint', () => {
  test('names +fund with the rounded-up shortfall when the app account is short', async () => {
    const { minBalanceHint } = await import('../src/features/action/cards.js')
    const algosdk = (await import('algosdk')).default
    const app = algosdk.getApplicationAddress(BigInt(1003)).toString()
    const message = `transaction X: account ${app} balance 0 below min 109700 (0 assets)`
    expect(minBalanceHint(message, 'HelloWorld.hello(name: "hey") → app 1003')).toContain(
      '+fund 0.11',
    )
    const other = `transaction X: account ${'A'.repeat(58)} balance 5 below min 100000 (0 assets)`
    expect(minBalanceHint(other, 'HelloWorld.hello(name: "hey") → app 1003')).toContain(
      'fund it first',
    )
    expect(minBalanceHint('logic eval error', 'x')).toBeUndefined()
  })
})
