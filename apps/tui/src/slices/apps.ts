import { loadStoredApps, type StoredAppEntry } from '@initlabs/vibekit-agent/config'
import type { LiveNetworkId } from '@initlabs/vibekit-experience/live'
import { tryNormalizeAppSpec, type NormalizedAppSpec } from '@initlabs/vibekit-tools'
import { readdirSync, readFileSync, type Dirent } from 'node:fs'
import { join } from 'node:path'
import { useEffect, useMemo, useState } from 'react'

import type { WorkspaceScreen } from '../chrome.js'

/** A validated app spec file found under the launch directory. */
export interface LocalAppSpec {
  /** Path relative to the scanned root, POSIX separators. */
  path: string
  spec: NormalizedAppSpec
}

/** One row on the My Apps screen; numbering runs deployed-first. */
export type AppsEntry =
  | { kind: 'deployed'; name: string; appId: number }
  | { kind: 'local'; spec: LocalAppSpec }

const SKIP_DIRS = new Set(['node_modules', 'dist'])
/** Typical compiler output dirs where any *.json is worth sniffing. */
const OUTPUT_DIRS = new Set(['artifacts', 'contracts', 'smart_contracts'])
const SPEC_FILE_PATTERN = /(\.arc56\.json|\.arc32\.json|\.appspec\.json)$/
/** Anything bigger is not a hand-authored app spec; skip before JSON.parse. */
const MAX_SPEC_BYTES = 4 * 1024 * 1024

/**
 * Whether a file name looks like an app spec worth validating: the known
 * spec-file names anywhere, or any .json inside a typical output dir.
 */
export function isAppSpecCandidate(fileName: string, dirSegments: readonly string[]): boolean {
  if (!fileName.endsWith('.json')) return false
  if (SPEC_FILE_PATTERN.test(fileName) || fileName === 'application.json') return true
  return dirSegments.some((segment) => OUTPUT_DIRS.has(segment))
}

/**
 * Depth-limited scan for ARC-56/ARC-32/ARC-4 spec files. Candidates that are
 * not valid JSON or not app specs are silently skipped; unreadable
 * directories are treated as empty. Dot-dirs (.git and friends) are skipped.
 */
export function scanAppSpecs(root: string, maxDepth = 4): LocalAppSpec[] {
  const found: LocalAppSpec[] = []
  const walk = (dir: string, segments: readonly string[]) => {
    let entries: Dirent[]
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (segments.length >= maxDepth) continue
        if (entry.name.startsWith('.') || SKIP_DIRS.has(entry.name)) continue
        walk(join(dir, entry.name), [...segments, entry.name])
        continue
      }
      if (!entry.isFile() || !isAppSpecCandidate(entry.name, segments)) continue
      let raw: string
      try {
        raw = readFileSync(join(dir, entry.name), 'utf8')
      } catch {
        continue
      }
      if (raw.length > MAX_SPEC_BYTES) continue
      const spec = tryNormalizeAppSpec(raw)
      if (spec) found.push({ path: [...segments, entry.name].join('/'), spec })
    }
  }
  walk(root, [])
  return found.sort((a, b) => a.path.localeCompare(b.path))
}

/** Deployed rows first so [1-9] favors apps that already exist on-chain. */
export function appsEntries(
  deployed: readonly StoredAppEntry[],
  localSpecs: readonly LocalAppSpec[],
): AppsEntry[] {
  return [
    ...deployed.map((app) => ({ kind: 'deployed' as const, name: app.name, appId: app.appId })),
    ...localSpecs.map((spec) => ({ kind: 'local' as const, spec })),
  ]
}

/**
 * Owns the My Apps screen state: the launch-directory spec scan (once) and
 * the persisted deployed associations for the active network (re-read each
 * time the screen opens, so external edits to config.json show up).
 */
export function useApps({
  screen,
  network,
}: {
  screen: WorkspaceScreen
  network: LiveNetworkId
}) {
  const [localSpecs, setLocalSpecs] = useState<LocalAppSpec[]>([])
  const [deployed, setDeployed] = useState<readonly StoredAppEntry[]>([])
  const [selectedSpec, setSelectedSpec] = useState<LocalAppSpec | null>(null)

  useEffect(() => {
    setLocalSpecs(scanAppSpecs(process.cwd()))
  }, [])

  useEffect(() => {
    if (screen !== 'apps') return
    setDeployed(loadStoredApps()[network] ?? [])
  }, [network, screen])

  // Leaving the screen drops the detail pane so reopening starts at the list.
  useEffect(() => {
    if (screen !== 'apps') setSelectedSpec(null)
  }, [screen])

  const entries = useMemo(() => appsEntries(deployed, localSpecs), [deployed, localSpecs])

  return { deployed, localSpecs, entries, selectedSpec, setSelectedSpec }
}

export type AppsLane = ReturnType<typeof useApps>
