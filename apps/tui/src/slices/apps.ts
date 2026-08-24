import { executeToolCall, resolveDeployment, ToolError } from '@initlabs/vibekit-core'
import { loadStoredApps, type StoredAppEntry } from '@initlabs/vibekit-agent/config'
import type { StructuredResult } from '@initlabs/vibekit-explorer'
import type { LiveNetworkId } from '@initlabs/vibekit-explorer/live'
import {
  contractWriteTools,
  DEPLOYER_NOTE_PREFIX,
  toolArgsFor,
  toolsFromArc56,
  toolsWithMethods,
  tryNormalizeAppSpec,
  type NormalizedAppSpec,
  type ParsedMethod,
} from '@initlabs/vibekit-tools'
import { readdirSync, readFileSync, type Dirent } from 'node:fs'
import { join } from 'node:path'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { specCatalog, specsByProgramHash } from '../abi-catalog.js'
import { parseMethodArgs } from '../method-args.js'
import type { WorkspaceScreen } from '../chrome.js'

/** A validated app spec file found under the launch directory. */
export interface LocalAppSpec {
  /** Path relative to the scanned root, POSIX separators. */
  path: string
  spec: NormalizedAppSpec
}

/**
 * One contract on the My Apps screen: every spec file, deployment, and
 * opted-in app id that shares a name. Cards render one group each.
 */
export interface AppGroup {
  name: string
  /** The richest spec for this name (ARC-56 first); absent for on-chain-only apps. */
  spec?: LocalAppSpec
  /** Every spec file with this name, richest first. */
  specs: LocalAppSpec[]
  /** Deployments, newest first. */
  deployed: DeployedApp[]
  /** App ids the active account holds local state for. */
  optedIn: number[]
}

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

/** A deployment: the stored association, plus the creator when it was detected on-chain. */
export interface DeployedApp extends StoredAppEntry {
  creator?: string
}

/**
 * Deployments found on-chain: app-create transactions carrying the AlgoKit
 * deployer note (`ALGOKIT_DEPLOYER:j{"name":…}`), which algokit-utils and
 * VibeKit's app_deploy both stamp. Reads a transaction.list record.
 */
export function deployedFromRecord(record: StructuredResult): DeployedApp[] {
  if (record.state !== 'success') return []
  const rows = (record.data as { transactions?: unknown })?.transactions
  if (!Array.isArray(rows)) return []
  const found: DeployedApp[] = []
  for (const row of rows) {
    const { note, createdApplicationId, sender } = (row ?? {}) as {
      note?: unknown
      createdApplicationId?: unknown
      sender?: unknown
    }
    const appId = Number(createdApplicationId)
    if (typeof note !== 'string' || !note.startsWith(DEPLOYER_NOTE_PREFIX) || !(appId > 0)) continue
    try {
      const { name } = JSON.parse(note.slice(DEPLOYER_NOTE_PREFIX.length)) as { name?: unknown }
      if (typeof name === 'string' && name.length > 0) {
        found.push({ name, appId, ...(typeof sender === 'string' ? { creator: sender } : {}) })
      }
    } catch {
      // Not the deployer's JSON after all — some other note with the same prefix.
    }
  }
  return found
}

/** Stored + detected, one row per app id, newest deployment first so [1] and name lookups hit the current one. */
export function mergeDeployed(...sources: ReadonlyArray<readonly DeployedApp[]>): DeployedApp[] {
  const byId = new Map<number, DeployedApp>()
  for (const entry of sources.flat()) if (!byId.has(entry.appId)) byId.set(entry.appId, entry)
  return [...byId.values()].sort((a, b) => b.appId - a.appId)
}

/** One decoded state row off an application.state record. */
export interface AppStateEntry {
  key: string
  value: string
}

/** The deploy line for a spec with TMPL_* variables, shaped like a method so the same line parses it. */
export function deployMethod(spec: NormalizedAppSpec): ParsedMethod {
  return {
    name: 'deploy',
    signature: `deploy(${spec.templateVariables.join(',')})`,
    args: spec.templateVariables.map((name) => ({ name, type: 'string' })),
    returns: { type: 'void' },
  }
}

/** An open card: its group, the spec it renders, and the app id read methods simulate against. */
export interface SpecSelection {
  group: AppGroup
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
  // ARC-56 first: when a name exists in several formats, the richest spec wins by-name lookups.
  return found.sort(
    (a, b) => Number(b.spec.format === 'arc56') - Number(a.spec.format === 'arc56') || a.path.localeCompare(b.path),
  )
}

/**
 * Groups by contract name; deployed apps first (newest first), then
 * opted-in-only, then specs with nothing on-chain, so [1-9] favors apps that
 * already exist. Opted-in apps with no known name group as `app <id>`.
 */
export function appGroups(
  deployed: readonly DeployedApp[],
  optedIn: readonly OptedInApp[],
  localSpecs: readonly LocalAppSpec[],
): AppGroup[] {
  const groups = new Map<string, AppGroup>()
  const group = (name: string) => {
    let found = groups.get(name)
    if (!found) {
      found = { name, specs: [], deployed: [], optedIn: [] }
      groups.set(name, found)
    }
    return found
  }
  for (const spec of localSpecs) group(spec.spec.name).specs.push(spec)
  for (const entry of deployed) group(entry.name).deployed.push(entry)
  for (const app of optedIn) group(app.name ?? `app ${app.appId}`).optedIn.push(app.appId)
  const rank = (g: AppGroup) => (g.deployed.length > 0 ? 0 : g.optedIn.length > 0 ? 1 : 2)
  return [...groups.values()]
    .map((g) => ({ ...g, spec: g.specs[0], deployed: [...g.deployed].sort((a, b) => b.appId - a.appId) }))
    .sort(
      (a, b) =>
        rank(a) - rank(b) ||
        (b.deployed[0]?.appId ?? b.optedIn[0] ?? 0) - (a.deployed[0]?.appId ?? a.optedIn[0] ?? 0) ||
        a.name.localeCompare(b.name),
    )
}

/**
 * Owns the My Apps screen state: the launch-directory spec scan (once),
 * the deployed apps for the active network (persisted associations re-read
 * each time the screen opens, merged with deployer-note deployments found
 * on-chain — network-wide on localnet, the active account's elsewhere), and
 * the active account's opted-in apps from `lookupAccountAppStates`.
 */
export function useApps({
  screen,
  network,
  sender,
  live,
  host,
  onDraft,
}: {
  screen: WorkspaceScreen
  network: LiveNetworkId
  sender?: string
  live: 'probing' | boolean
  host: () => {
    lookupAccountAppStates(address: string): Promise<StructuredResult>
    callTool(toolName: string, args: Record<string, unknown>): Promise<StructuredResult>
  }
  /** A composed write (the tool's unsigned-group wire) for the approval flow: review, simulate, sign. */
  onDraft: (wire: unknown, toolName: string, label: string) => void
}) {
  const [localSpecs, setLocalSpecs] = useState<LocalAppSpec[]>([])
  const [stored, setStored] = useState<readonly StoredAppEntry[]>([])
  const [detected, setDetected] = useState<readonly DeployedApp[]>([])
  const [deployedLoading, setDeployedLoading] = useState(false)
  const [deployedError, setDeployedError] = useState<string | null>(null)
  const [globalState, setGlobalState] = useState<AppStateEntry[] | null>(null)
  const [optedIn, setOptedIn] = useState<readonly OptedInApp[]>([])
  const [optedInLoading, setOptedInLoading] = useState(false)
  const [selected, setSelected] = useState<SpecSelection | null>(null)
  const [selectedMethod, setSelectedMethod] = useState<ParsedMethod | null>(null)
  /** The deploy line is open: enter composes a create for the selected spec. */
  const [deployOpen, setDeployOpen] = useState(false)
  const [callInput, setCallInput] = useState('')
  const [callEpoch, setCallEpoch] = useState(0)
  const [callBusy, setCallBusy] = useState(false)
  const [callError, setCallError] = useState<string | null>(null)
  const [callResult, setCallResult] = useState<unknown>(null)

  useEffect(() => {
    setLocalSpecs(scanAppSpecs(process.cwd()))
  }, [])

  useEffect(() => {
    // Re-read on screen open too: a deploy or a hand-edit of config.json
    // must not leave the list (and the generated tool set) stale.
    setStored(loadStoredApps()[network] ?? [])
  }, [network, screen])

  useEffect(() => {
    if (screen !== 'apps' || live !== true) return
    // Localnet is ours: every deployment counts. Elsewhere only the active account's.
    if (network !== 'localnet' && !sender) {
      setDetected([])
      return
    }
    let cancelled = false
    setDeployedLoading(true)
    setDeployedError(null)
    const query = { txType: 'appl', notePrefix: DEPLOYER_NOTE_PREFIX, limit: 100 }
    // ponytail: first page only; page on nextToken if a network ever holds >100 deployments.
    const call =
      network === 'localnet'
        ? host().callTool('search_transactions', query)
        : host().callTool('search_account_transactions', { ...query, address: sender })
    call
      .then((record) => {
        if (cancelled) return
        setDetected(deployedFromRecord(record))
        if (record.state !== 'success') setDeployedError('Could not search the indexer for deployments.')
        setDeployedLoading(false)
      })
      .catch((error) => {
        if (cancelled) return
        setDeployedError(`Could not search for deployments — ${error instanceof Error ? error.message : String(error)}`)
        setDeployedLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [host, live, network, screen, sender])

  const deployed = useMemo(() => mergeDeployed(stored, detected), [detected, stored])

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

  // A bound spec shows its live global state, named through the spec file.
  useEffect(() => {
    setGlobalState(null)
    if (!selected || selected.appId === undefined || live !== true) return
    let cancelled = false
    host()
      .callTool('read_global_state', { appId: selected.appId, appSpecPath: selected.spec.path })
      .then((record) => {
        if (cancelled || record.state !== 'success') return
        const entries = (record.data as { entries?: unknown }).entries
        if (Array.isArray(entries)) setGlobalState(entries as AppStateEntry[])
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [host, live, selected])

  const catalog = useMemo(() => specCatalog(deployed, localSpecs), [deployed, localSpecs])
  const hashCatalog = useMemo(() => specsByProgramHash(localSpecs), [localSpecs])
  const groups = useMemo(
    () =>
      appGroups(
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
    setDeployOpen(false)
    setCallInput('')
    setCallResult(null)
    setCallError(null)
    setCallEpoch((epoch) => epoch + 1)
  }, [])

  const closeDetail = useCallback(() => {
    if (selectedMethod || deployOpen) {
      selectMethod(null)
      return
    }
    setSelected(null)
  }, [deployOpen, selectMethod, selectedMethod])

  /** Composes a bare create of the selected spec; TMPL_* values come from the line first. */
  const submitDeploy = useCallback(
    (values: Record<string, unknown>) => {
      if (!selected) return
      if (!sender) {
        setCallError('Pick an active account with ^w first.')
        return
      }
      if (live !== true) {
        setCallError(`Need a live ${network} to deploy.`)
        return
      }
      const tool = contractWriteTools.find((entry) => entry.name === 'app_deploy')!
      const deployTimeParams = Object.fromEntries(
        Object.entries(values).map(([key, value]) => [key, /^\d+$/.test(String(value)) ? Number(value) : String(value)]),
      )
      setCallBusy(true)
      setCallError(null)
      const deployment = resolveDeployment({ network, mode: 'compose', tools: [tool] })
      void executeToolCall(deployment, tool, {
        sender,
        appSpecPath: selected.spec.path,
        ...(Object.keys(deployTimeParams).length > 0 ? { deployTimeParams } : {}),
      })
        .then((result) => {
          setCallBusy(false)
          setDeployOpen(false)
          onDraft(result, tool.name, `${selected.spec.spec.name}.deploy`)
        })
        .catch((error) => {
          setCallBusy(false)
          setCallError(error instanceof ToolError ? error.message : String(error))
        })
    },
    [live, network, onDraft, selected, sender],
  )

  /** d: deploy now, or open the deploy line when the spec has template variables. */
  const startDeploy = useCallback(() => {
    if (!selected) return
    setSelectedMethod(null)
    setCallResult(null)
    setCallError(null)
    if (selected.spec.spec.templateVariables.length === 0) {
      submitDeploy({})
      return
    }
    setDeployOpen(true)
    setCallInput('')
    setCallEpoch((epoch) => epoch + 1)
  }, [selected, submitDeploy])

  const submitCall = useCallback(() => {
    if (selected && deployOpen) {
      const parsed = parseMethodArgs(deployMethod(selected.spec.spec), callInput)
      if (!parsed.ok) setCallError(parsed.error)
      else submitDeploy(parsed.named)
      return
    }
    if (!selected || !selectedMethod) return
    const readonly = selectedMethod.readonly === true
    if (selected.appId === undefined) {
      setCallError('Not deployed on this network — deploy first, or ask the agent to.')
      return
    }
    if (!sender) {
      setCallError('Pick an active account with ^w first.')
      return
    }
    if (live !== true) {
      setCallError(`Need a live ${network} to ${readonly ? 'simulate' : 'compose'}.`)
      return
    }
    const parsed = parseMethodArgs(selectedMethod, callInput)
    if (!parsed.ok) {
      setCallError(parsed.error)
      return
    }
    // Pair by method: tool names are slugged, and one signature can be a
    // substring of another (`add` inside `readd`).
    const generated = toolsWithMethods(selected.spec.spec, { appId: selected.appId }).find(
      (entry) => entry.tool.requiresSigner !== readonly && entry.method.signature === selectedMethod.signature,
    )
    if (!generated) {
      setCallError('No tool generated for this method.')
      return
    }
    const { tool, method } = generated
    setCallBusy(true)
    setCallError(null)
    setCallResult(null)
    // Compose mode for both: reads simulate signerless; writes come back as an
    // unsigned group the approval flow reviews, simulates, and signs.
    const deployment = resolveDeployment({ network, mode: 'compose', tools: [tool] })
    void executeToolCall(deployment, tool, {
      sender,
      ...toolArgsFor(method, parsed.named),
      ...(parsed.extraFeeMicroAlgos === undefined ? {} : { extraFee: parsed.extraFeeMicroAlgos }),
      ...(parsed.fundMicroAlgos === undefined || readonly ? {} : { fundAppMicroAlgos: parsed.fundMicroAlgos }),
    })
      .then((result) => {
        setCallBusy(false)
        if (readonly) {
          setCallResult(result)
          setCallEpoch((epoch) => epoch + 1)
          return
        }
        onDraft(result, tool.name, `${selected.spec.spec.name}.${method.name}`)
      })
      .catch((error) => {
        setCallBusy(false)
        setCallError(error instanceof ToolError ? error.message : String(error))
      })
  }, [callInput, deployOpen, live, network, onDraft, selected, selectedMethod, sender, submitDeploy])

  return {
    deployed,
    deployedLoading,
    deployedError,
    globalState,
    localSpecs,
    optedInLoading,
    groups,
    catalog,
    hashCatalog,
    extraTools,
    selected,
    selectedMethod,
    deployOpen,
    startDeploy,
    selectSpec,
    selectMethod,
    closeDetail,
    setCallInput,
    setCallError,
    callEpoch,
    callBusy,
    callError,
    callResult,
    submitCall,
  }
}
