import { describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { appsEntries, isAppSpecCandidate, scanAppSpecs } from '../src/slices/apps.js'

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
    expect(results.map((entry) => entry.path)).toEqual([
      'contracts/greeter.json',
      'counter.arc56.json',
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
  test('deployed rows come first so 1-9 favors on-chain apps', () => {
    const local = scanAppSpecs(tree()).slice(0, 1)
    const entries = appsEntries([{ name: 'Counter', appId: 1042 }], local)
    expect(entries[0]).toEqual({ kind: 'deployed', name: 'Counter', appId: 1042 })
    expect(entries[1]).toEqual({ kind: 'local', spec: local[0]! })
  })
})
