import { describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

import {
  CATALOGS,
  catalogTarballUrl,
  githubToken,
  qualifiedCatalogNames,
  splitCatalogSelection,
} from '../src/skills/catalogs.js'

describe('skill catalogs', () => {
  test('every catalog is pinned to a commit SHA, never a branch', () => {
    for (const catalog of CATALOGS) {
      expect(catalog.ref).toMatch(/^[0-9a-f]{40}$/)
      expect(catalog.skills.length).toBeGreaterThan(0)
    }
  })

  test('tarball url points at codeload with the pinned ref', () => {
    expect(catalogTarballUrl(CATALOGS[0]!)).toBe(
      `https://codeload.github.com/TxnLab/skills/tar.gz/${CATALOGS[0]!.ref}`,
    )
  })

  test('qualified names are <catalog>/<skill>', () => {
    expect(qualifiedCatalogNames()).toContain('txnlab/nfd')
  })

  test('splitCatalogSelection groups picks per catalog and ignores bundled names', () => {
    expect(splitCatalogSelection(['use-vibekit', 'txnlab/nfd', 'txnlab/use-wallet'])).toEqual([
      { catalog: CATALOGS[0]!, names: ['nfd', 'use-wallet'] },
    ])
    expect(splitCatalogSelection(['use-vibekit'])).toEqual([])
  })
})

describe('githubToken', () => {
  test('env wins; config.json github.token is the fallback; absent is undefined', () => {
    const configHome = mkdtempSync(join(tmpdir(), 'vibekit-catalogs-test-'))
    const env = { XDG_CONFIG_HOME: configHome } as Record<string, string | undefined>

    expect(githubToken(env)).toBeUndefined()

    mkdirSync(join(configHome, 'vibekit'), { recursive: true })
    writeFileSync(
      join(configHome, 'vibekit', 'config.json'),
      JSON.stringify({ github: { token: 'from-config' } }),
    )
    expect(githubToken(env)).toBe('from-config')

    expect(githubToken({ ...env, GITHUB_TOKEN: 'from-env' })).toBe('from-env')
  })
})
