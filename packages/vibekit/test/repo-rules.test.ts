/**
 * Repository rules that hold by discipline, pinned by a test: dependencies
 * point inward within this package, and comments describe the code as
 * committed (no plan language, no synonyms for the glossary's terms).
 */
import { describe, expect, test } from 'bun:test'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const SRC = new URL('../src', import.meta.url).pathname
const REPO = new URL('../../..', import.meta.url).pathname

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    if (entry === 'node_modules' || entry === 'dist' || entry === '.next' || entry === 'bin')
      continue
    if (statSync(path).isDirectory()) walk(path, out)
    else if (/\.(ts|tsx|md)$/.test(entry) && !path.endsWith('bundled.ts')) out.push(path)
  }
  return out
}

/** Which src area a file belongs to: core, tools, plugins, agent, mcp, signer-keystore, preset. */
function areaOf(file: string): string {
  return relative(SRC, file).split('/')[0]!
}

describe('dependencies point inward', () => {
  // Everything may import core. tools may import tools/shared. Only preset fans out.
  const allowed: Record<string, string[]> = {
    core: ['core'],
    tools: ['core', 'tools'],
    plugins: ['core'],
    agent: ['core'],
    mcp: ['core'],
    'signer-keystore': ['core'],
    preset: ['core', 'tools', 'plugins', 'signer-keystore'],
  }

  test('every src area imports only from core (plus its own area)', () => {
    const violations: string[] = []
    for (const file of walk(SRC).filter((f) => f.endsWith('.ts'))) {
      const area = areaOf(file)
      if (area === 'index.ts') continue
      const source = readFileSync(file, 'utf8')
      for (const match of source.matchAll(/from '(\.[^']*)'/g)) {
        const target = join(file, '..', match[1]!)
        const targetArea = areaOf(target)
        const ok = targetArea === area || (allowed[area] ?? []).includes(targetArea)
        if (!ok) violations.push(`${relative(SRC, file)} -> ${relative(SRC, target)}`)
      }
    }
    expect(violations).toEqual([])
  })
})

describe('comments describe the code as committed', () => {
  // Words the glossary retired or that name a plan instead of the code.
  const banned =
    /\bprovisional\b|\bPhase \d\b|\bpredate L\d\b|vertical slices?\b|\bhosted API\b|\bview cue\b|\bkernel\b|batteries-included|\bheads?\b(?! of )|\bdoor\b/i

  test('no plan language or retired terms in source and docs', () => {
    const roots = [
      'packages/vibekit/src',
      'packages/explorer/src',
      'apps/cli/src',
      'apps/tui/src',
      'apps/agent/src',
      'apps/agent/app',
      'docs',
      'AGENTS.md',
      'README.md',
    ]
    const hits: string[] = []
    for (const root of roots) {
      const path = join(REPO, root)
      let files: string[]
      try {
        files = statSync(path).isDirectory() ? walk(path) : [path]
      } catch {
        continue // a packed consumer has no apps; the rule still holds for what is there
      }
      for (const file of files) {
        const lines = readFileSync(file, 'utf8').split('\n')
        lines.forEach((line, i) => {
          if (line.includes('refs/heads/') || /<\/?head>/.test(line)) return
          if (file.endsWith('AGENTS.md') && /Not "kernel"|"provisional"/.test(line)) return
          if (banned.test(line)) hits.push(`${relative(REPO, file)}:${i + 1}: ${line.trim()}`)
        })
      }
    }
    expect(hits).toEqual([])
  })
})
