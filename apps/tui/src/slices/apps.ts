import { executeToolCall, resolveDeployment, ToolError } from '@initlabs/vibekit-core'
import { loadStoredApps, type StoredAppEntry } from '@initlabs/vibekit-agent/config'
import type { StructuredResult } from '@initlabs/vibekit-experience'
import type { LiveNetworkId } from '@initlabs/vibekit-experience/live'
import {
  toolsFromArc56,
  tryNormalizeAppSpec,
  type NormalizedAppSpec,
  type ParsedMethod,
} from '@initlabs/vibekit-tools'
import { readdirSync, readFileSync, type Dirent } from 'node:fs'
import { join } from 'node:path'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { specCatalog } from '../abi-catalog.js'
import type { WorkspaceScreen } from '../chrome.js'

/** A validated app spec file found under the launch directory. */
export interface LocalAppSpec {
  /** Path relative to the scanned root, POSIX separators. */
  path: string
  spec: NormalizedAppSpec
}

/** One row on the My Apps screen; numbering runs deployed, then opted-in, then local. */
export type AppsEntry =
  | { kind: 'deployed'; name: string; appId: number }
  | { kind: 'optedIn'; appId: number; name?: string }
  | { kind: 'local'; spec: LocalAppSpec }

/** One application the active account holds local state for. */
export interface OptedInApp {
  appId: number
  name?: string
}

/** Pulls opted-in app ids out of an `application.locals` result. */
export function optedInFromRecord(record: StructuredResult): OptedInApp[] {
  if (record.state !== 'success') return []
  const data = record.data
  if (data === null || typeof data !== 'object' || Array.isArray(data)) return []
  const apps = (data as { apps?: unknown }).apps
  if (!Array.isArray(apps)) return []
  const found: OptedInApp[] = []
  for (const app of apps) {
    if (app === null || typeof app !== 'object' || Array.isArray(app)) continue
    const id = (app as { applicationId?: unknown }).applicationId
    if (typeof id === 'number' && Number.isInteger(id) && id > 0) found.push({ appId: id })
  }
  return found
}

/** Spec detail, optionally bound to a deployed app id so read methods can simulate. */
export interface SpecSelection {
  spec: LocalAppSpec
  appId?: number
}

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

/** Deployed, then opted-in, then local so [1-9] favors apps that already exist on-chain. */
export function appsEntries(
  deployed: readonly StoredAppEntry[],
  optedIn: readonly OptedInApp[],
  localSpecs: readonly LocalAppSpec[],
): AppsEntry[] {
  return [
    ...deployed.map((app) => ({ kind: 'deployed' as const, name: app.name, appId: app.appId })),
    ...optedIn.map((app) => ({
      kind: 'optedIn' as const,
      appId: app.appId,
      ...(app.name === undefined ? {} : { name: app.name }),
    })),
    ...localSpecs.map((spec) => ({ kind: 'local' as const, spec })),
  ]
}

/**
 * Owns the My Apps screen state: the launch-directory spec scan (once),
 * the persisted deployed associations for the active network (re-read each
 * time the screen opens, so external edits to config.json show up), and the
 * active account's opted-in apps from `lookupAccountAppStates`.
 */
export function useApps({
  screen,
  network,
  sender,
  live,
  host,
}: {
  screen: WorkspaceScreen
  network: LiveNetworkId
  sender?: string
  live: 'probing' | boolean
  host: () => { lookupAccountAppStates(address: string): Promise<StructuredResult> }
}) {
  const [localSpecs, setLocalSpecs] = useState<LocalAppSpec[]>([])
  const [deployed, setDeployed] = useState<readonly StoredAppEntry[]>([])
  const [optedIn, setOptedIn] = useState<readonly OptedInApp[]>([])
  const [optedInLoading, setOptedInLoading] = useState(false)
  const [selected, setSelected] = useState<SpecSelection | null>(null)
  const [selectedMethod, setSelectedMethod] = useState<ParsedMethod | null>(null)
  const [callInput, setCallInput] = useState('')
  const [callEpoch, setCallEpoch] = useState(0)
  const [callBusy, setCallBusy] = useState(false)
  const [callError, setCallError] = useState<string | null>(null)
  const [callResult, setCallResult] = useState<unknown>(null)

  useEffect(() => {
    setLocalSpecs(scanAppSpecs(process.cwd()))
  }, [])

  useEffect(() => {
    setDeployed(loadStoredApps()[network] ?? [])
  }, [network])

  useEffect(() => {
    if (screen !== 'apps') return
    if (!sender) {
      setOptedIn([])
      setOptedInLoading(false)
      return
    }
    let cancelled = false
    setOptedInLoading(true)
    host()
      .lookupAccountAppStates(sender)
      .then((record) => {
        if (cancelled) return
        setOptedIn(optedInFromRecord(record))
        setOptedInLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setOptedIn([])
        setOptedInLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [host, live, screen, sender])

  // Leaving the screen drops the detail pane so reopening starts at the list.
  useEffect(() => {
    if (screen !== 'apps') {
      setSelected(null)
      setSelectedMethod(null)
      setCallResult(null)
      setCallError(null)
    }
  }, [screen])

  const catalog = useMemo(() => specCatalog(deployed, localSpecs), [deployed, localSpecs])
  const entries = useMemo(
    () =>
      appsEntries(
        deployed,
        optedIn.map((app) => ({
          appId: app.appId,
          name: catalog.get(app.appId)?.name,
        })),
        localSpecs,
      ),
    [catalog, deployed, localSpecs, optedIn],
  )

  const extraTools = useMemo(() => {
    const taken = new Set<string>()
    const tools = []
    for (const entry of deployed) {
      const spec = catalog.get(entry.appId)
      if (!spec) continue
      for (const tool of toolsFromArc56(spec, { appId: entry.appId })) {
        if (taken.has(tool.name)) continue
        taken.add(tool.name)
        tools.push(tool)
      }
    }
    return tools
  }, [catalog, deployed])

  const selectSpec = useCallback((selection: SpecSelection) => {
    setSelected(selection)
    setSelectedMethod(null)
    setCallInput('')
    setCallResult(null)
    setCallError(null)
    setCallEpoch((epoch) => epoch + 1)
  }, [])

  const selectMethod = useCallback((method: ParsedMethod | null) => {
    setSelectedMethod(method)
    setCallInput('')
    setCallResult(null)
    setCallError(null)
    setCallEpoch((epoch) => epoch + 1)
  }, [])

  const closeDetail = useCallback(() => {
    if (selectedMethod) {
      selectMethod(null)
      return
    }
    setSelected(null)
  }, [selectMethod, selectedMethod])

  const submitCall = useCallback(() => {
    if (!selected || !selectedMethod || selectedMethod.readonly !== true) return
    if (selected.appId === undefined) {
      setCallError('Bind a deployed app id (same name in the apps config) to simulate.')
      return
    }
    if (!sender) {
      setCallError('Pick an active account with ^w first.')
      return
    }
    if (live !== true) {
      setCallError('Need a live network to simulate.')
      return
    }
    let named: Record<string, unknown> = {}
    const raw = callInput.trim()
    if (raw.length > 0) {
      try {
        const parsed: unknown = JSON.parse(raw)
        if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
          named = parsed as Record<string, unknown>
        } else {
          const first = selectedMethod.args[0]
          const key = first?.name && first.name.length > 0 ? first.name : 'arg0'
          named = { [key]: parsed }
        }
      } catch {
        setCallError('Args must be JSON (object, or a single value for one-arg methods).')
        return
      }
    }
    const tool = toolsFromArc56(selected.spec.spec, { appId: selected.appId }).find(
      (entry) => !entry.requiresSigner && entry.description.includes(selectedMethod.signature),
    )
    if (!tool) {
      setCallError('No readonly tool generated for this method.')
      return
    }
    setCallBusy(true)
    setCallError(null)
    setCallResult(null)
    const deployment = resolveDeployment({ network, mode: 'compose', tools: [tool] })
    void executeToolCall(deployment, tool, { sender, ...named })
      .then((result) => {
        setCallResult(result)
        setCallBusy(false)
        setCallEpoch((epoch) => epoch + 1)
      })
      .catch((error) => {
        setCallBusy(false)
        setCallError(error instanceof ToolError ? error.message : String(error))
      })
  }, [callInput, live, network, selected, selectedMethod, sender])

  return {
    deployed,
    localSpecs,
    optedIn,
    optedInLoading,
    entries,
    catalog,
    extraTools,
    selected,
    selectedMethod,
    selectSpec,
    selectMethod,
    closeDetail,
    callInput,
    setCallInput,
    callEpoch,
    callBusy,
    callError,
    callResult,
    submitCall,
  }
}

export type AppsLane = ReturnType<typeof useApps>
