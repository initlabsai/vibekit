import { describe, expect, test } from 'bun:test'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const root = join(import.meta.dir, '..')
const FORBIDDEN = ["'@initlabs/vibekit-explorer/live'", "'@initlabs/vibekit'", "'@initlabs/vibekit/"]
// The action machine is browser-safe (the explorer root the browser already bundles is built on it).
const ALLOWED = ["'@initlabs/vibekit/actions'"]

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    if (name === 'node_modules' || name === '.next' || name === 'dist') return []
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return walk(path)
    // Tests of the route may stub the live host; they never ship in the bundle.
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : []
  })
}

describe('browser bundle boundary', () => {
  test('only app/api/** imports the live host or the vibekit package', () => {
    const offenders = walk(root)
      .filter((path) => !relative(root, path).startsWith('app/api/'))
      .filter((path) => {
        const source = ALLOWED.reduce((text, needle) => text.replaceAll(needle, ''), readFileSync(path, 'utf8'))
        return FORBIDDEN.some((needle) => source.includes(needle))
      })
      .map((path) => relative(root, path))
    expect(offenders).toEqual([])
  })
})
