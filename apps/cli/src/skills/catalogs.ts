/**
 * Remote skill catalogs — curated third-party skill repos offered alongside
 * the bundled skills. Each catalog is pinned to a reviewed commit SHA and
 * lists the skills present at that commit, so selection and flag validation
 * stay offline; the tarball is fetched only when installing.
 *
 * Bumping a pin: review the new content, then update `ref` and `skills`
 * together in one commit. Never point `ref` at a branch — a branch ref
 * ships whatever upstream pushes next, unreviewed.
 */

import { readFileSync } from 'fs'
import { mkdtemp, readdir, readFile, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join, relative } from 'path'

import { vibekitConfigPath } from '@initlabs/vibekit/agent/config'

import { extractTarball } from '../utils/tarball.js'
import type { SkillDirectory, SkillFile } from './index.js'

export interface SkillCatalog {
  id: string
  /** GitHub owner/name. */
  repo: string
  /** Directory inside the repo holding `<skill>/SKILL.md` directories. */
  subpath: string
  /** Pinned commit SHA — review the content before bumping. */
  ref: string
  /** Skill directory names present at `ref`; keeps selection offline. */
  skills: readonly string[]
  label: string
}

export const CATALOGS: SkillCatalog[] = [
  {
    id: 'txnlab',
    repo: 'TxnLab/skills',
    subpath: 'skills',
    ref: '1c99652a1aca47b5b5b76034e962d8cb7f123a37',
    skills: ['haystack-router', 'nfd', 'use-wallet'],
    label: 'TxnLab',
  },
]

/** Catalog skills as `<catalog>/<skill>` — the names `--skills` and the wizard use. */
export function qualifiedCatalogNames(): string[] {
  return CATALOGS.flatMap((catalog) => catalog.skills.map((name) => `${catalog.id}/${name}`))
}

/** Split a selection into per-catalog picks (bundled names pass through untouched elsewhere). */
export function splitCatalogSelection(
  selected: string[],
): { catalog: SkillCatalog; names: string[] }[] {
  return CATALOGS.map((catalog) => ({
    catalog,
    names: selected
      .filter((name) => name.startsWith(`${catalog.id}/`))
      .map((name) => name.slice(catalog.id.length + 1)),
  })).filter((entry) => entry.names.length > 0)
}

export function catalogTarballUrl(catalog: SkillCatalog): string {
  return `https://codeload.github.com/${catalog.repo}/tar.gz/${catalog.ref}`
}

/**
 * GITHUB_TOKEN env, else `github.token` in ~/.config/vibekit/config.json.
 * Absent is fine — public catalogs need no auth on codeload.
 */
export function githubToken(
  env: Record<string, string | undefined> = process.env,
): string | undefined {
  if (env.GITHUB_TOKEN) return env.GITHUB_TOKEN
  try {
    const raw = JSON.parse(readFileSync(vibekitConfigPath(env), 'utf8')) as {
      github?: { token?: unknown }
    }
    return typeof raw.github?.token === 'string' ? raw.github.token : undefined
  } catch {
    return undefined
  }
}

// Same rule as scripts/bundle-skills.ts: a skill is its .md files.
async function readSkillFiles(dir: string): Promise<SkillFile[]> {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true }).catch(() => null)
  if (!entries) return []
  const files: SkillFile[] = []
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.md')) continue
    const fullPath = join(entry.parentPath, entry.name)
    files.push({ path: relative(dir, fullPath), content: await readFile(fullPath, 'utf-8') })
  }
  return files.sort((a, b) => a.path.localeCompare(b.path))
}

/** Fetch a catalog's pinned tarball and return the requested skills. */
export async function fetchCatalogSkills(
  catalog: SkillCatalog,
  names: string[],
): Promise<SkillDirectory[]> {
  const tmp = await mkdtemp(join(tmpdir(), `vibekit-skills-${catalog.id}-`))
  try {
    const token = githubToken()
    await extractTarball(
      catalogTarballUrl(catalog),
      tmp,
      token ? { Authorization: `Bearer ${token}` } : undefined,
    )
    const skills: SkillDirectory[] = []
    for (const name of names) {
      const files = await readSkillFiles(join(tmp, catalog.subpath, name))
      if (!files.some((file) => file.path === 'SKILL.md')) {
        throw new Error(
          `${catalog.repo}@${catalog.ref.slice(0, 7)} has no skill '${name}' — the pin and its skill list are out of sync`,
        )
      }
      skills.push({ name, files })
    }
    return skills
  } finally {
    await rm(tmp, { recursive: true, force: true })
  }
}
