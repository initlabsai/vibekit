/**
 * The TUI's natural-language lane: an in-process @initlabs/vibekit/agent
 * session over a compose-only localnet deployment. The model reads via tools
 * and composes writes as unsigned groups; it never signs (there is no
 * signer in its deployment) and never emits UI — its tool results become
 * records and trusted views through the explorer bridge, and any composed
 * unsigned group lands on the same approval card as a typed `pay`.
 */
import { type AgentEvent, type AgentSession } from '@initlabs/vibekit/agent'
import { createNetworkClients, resolveNetwork, type AnyTool } from '@initlabs/vibekit'
import { estimateProgramTokens } from '@initlabs/vibekit/tools'
import { readZeroSignalCatalog } from '@initlabs/vibekit/agent'
import { readLocalFile } from '@initlabs/vibekit/preset'
import {
  bridgeToolResult,
  unsignedGroupFromToolResult,
  type JsonValue,
  type ResultStore,
  type StructuredResult,
} from '@initlabs/vibekit-explorer'
import type { z } from 'zod'
import {
  activeSenderLine,
  createExplorerAgent as createSharedExplorerAgent,
  draftRecordFromComposeWire,
  explorerContext,
  explorerPlugins,
  explorerSystemPrompt,
  networkOfCall,
  type ExplorerAgentOptions as SharedAgentOptions,
  type LiveNetworkId,
} from '@initlabs/vibekit-explorer/live'

export { activeSenderLine, explorerContext, explorerSystemPrompt, networkOfCall }
import type { NormalizedAppSpec } from '@initlabs/vibekit/tools'
import { enrichResultWithAbi, type ProgramData } from '../apps/abi-catalog.js'
import { withAccountNames } from '../network/keystore-host.js'
import type { SectionBlock } from '../../feed/hooks.js'
import { viewFor } from '../../lookup.js'
import { shorten } from '../../theme.js'

/**
 * What a get_application_program call will cost, for the confirm modal: one
 * algod read for the program size, then the page estimate and, on ZeroSignal,
 * the catalog price of the session's model.
 */
export async function programCostLines(
  applicationId: number | undefined,
  network: LiveNetworkId,
  config: { provider: string; model: string },
): Promise<string[]> {
  if (applicationId === undefined)
    return ['The model asked for a program without an application id.']
  let bytes: number | undefined
  try {
    const { algod } = createNetworkClients(resolveNetwork(network))
    const app = await algod.getApplicationByID(applicationId).do()
    bytes = app.params?.approvalProgram?.length
  } catch {
    // Size unknown: the estimate below falls back to a full page.
  }
  const lines = [`app ${applicationId} on ${network}`]
  if (bytes === undefined) {
    lines.push('program size unknown — a page of TEAL is about 3k tokens')
    return lines
  }
  const est = estimateProgramTokens(bytes)
  lines.push(
    `${bytes.toLocaleString()} bytes of bytecode · ~${est.totalLines.toLocaleString()} lines of TEAL · ${est.pages} page${est.pages === 1 ? '' : 's'}`,
  )
  let cost = `~${(est.tokens / 1000).toFixed(1)}k tokens for the first page`
  if (config.provider === 'zerosignal') {
    const usd = readZeroSignalCatalog().get(config.model)?.inputUsdPer1M
    if (usd !== undefined)
      cost += ` · ≈ $${((est.tokens / 1e6) * usd).toFixed(4)} on ${config.model.split('/').pop()}`
  }
  lines.push(cost)
  if (est.pages > 1) lines.push("Further pages cost about the same and won't ask again.")
  return lines
}

export type ExplorerAgentOptions = SharedAgentOptions & {
  /** Names a program's selectors from a known spec, inside the tool call, so the model reads them. */
  labelProgram?: (program: ProgramData) => ProgramData['methods']
}

/** get_application_program with its methods labelled before the result leaves the tool. */
function withProgramLabels(
  tools: AnyTool[],
  label: ExplorerAgentOptions['labelProgram'],
): AnyTool[] {
  if (!label) return tools
  return tools.map((tool) =>
    tool.name === 'get_application_program'
      ? {
          ...tool,
          handler: async (ctx, args) => {
            const program = (await tool.handler(ctx, args)) as ProgramData
            return { ...program, methods: label(program) ?? program.methods }
          },
        }
      : tool,
  )
}

/** One throwaway instance of each built-in plugin, for metadata and view schemas. */
const BUILTIN_PLUGINS = explorerPlugins()

/**
 * Trusted plugin views, merged from the same plugins the session registers:
 * dotted plugin-namespaced view id → wire schema. A tool result declaring one
 * of these ids gets its card only after the wire parses.
 */
const PLUGIN_VIEWS = Object.assign(
  {},
  ...BUILTIN_PLUGINS.map((plugin) => plugin.views ?? {}),
) as Record<string, z.ZodType>

/** Name and blurb per built-in plugin, in display order — the plugins screen's rows. */
export const EXPLORER_PLUGIN_INFO = BUILTIN_PLUGINS.map(({ name, description }) => ({
  name,
  description,
}))

/** The terminal's agent: the shared session, reading specs from disk and labelling programs. */
export function createExplorerAgent(options: ExplorerAgentOptions): AgentSession {
  const { labelProgram, ...shared } = options
  return createSharedExplorerAgent({
    ...shared,
    // The Explorer runs on the user's machine: app specs may be read by path.
    readFile: readLocalFile,
    wrapTools: (tools) => withProgramLabels(tools, labelProgram),
  })
}

/**
 * What a coarse `table` view renders: top-level scalars as facts, plus the
 * first array-of-objects as rows. Any other shape stays raw.
 */
export function tableModel(
  data: unknown,
): { facts: Array<[string, string]>; rows: Array<Record<string, unknown>> } | undefined {
  if (data === null || typeof data !== 'object' || Array.isArray(data)) return undefined
  const record = data as Record<string, unknown>
  const rowsEntry = Object.entries(record).find(
    ([, value]) =>
      Array.isArray(value) &&
      value.length > 0 &&
      value.every((item) => item !== null && typeof item === 'object' && !Array.isArray(item)),
  )
  if (!rowsEntry) return undefined
  const facts = Object.entries(record)
    .filter(([, value]) => ['string', 'number', 'boolean'].includes(typeof value))
    .map(([key, value]) => [key, String(value)] as [string, string])
  return { facts, rows: rowsEntry[1] as Array<Record<string, unknown>> }
}

/** What the feed does with one tool result. */
export type ToolResultPlan = { usedNetwork: LiveNetworkId } & (
  | { kind: 'write'; draftRecord: StructuredResult }
  | { kind: 'cards'; record: StructuredResult; blocks: SectionBlock[]; note?: string }
  | { kind: 'dropped'; message: string }
)

/**
 * Decides what one tool result becomes — an approval flow, a record plus its
 * cards, or an error note — without touching any state. The tool's declared
 * view id selects the trusted view; a composed unsigned group outranks it.
 */
export function planToolResult(
  event: Extract<AgentEvent, { type: 'tool-result' }>,
  ctx: {
    sessionNetwork: LiveNetworkId
    /** A second composed group while one awaits approval renders raw instead. */
    paymentInFlight: boolean
    newId: (prefix: string) => string
    specCatalog: ReadonlyMap<number, NormalizedAppSpec>
    addressBook: ReadonlyArray<{ address: string; name?: string }>
  },
): ToolResultPlan {
  const usedNetwork = networkOfCall(event.input, ctx.sessionNetwork)
  const compose = unsignedGroupFromToolResult(event)
  if (compose && !ctx.paymentInFlight) {
    const draftRecord = draftRecordFromComposeWire(
      {
        resultId: ctx.newId('result-agent-payment-draft'),
        toolCallId: event.id,
        network: usedNetwork,
      },
      compose,
      event.toolName,
    )
    return { usedNetwork, kind: 'write', draftRecord }
  }
  try {
    const { network: _network, ...input } =
      event.input !== null && typeof event.input === 'object' && !Array.isArray(event.input)
        ? (event.input as Record<string, unknown>)
        : {}
    const {
      record: bridged,
      view,
      degraded,
    } = bridgeToolResult(event, {
      resultId: ctx.newId('result-agent'),
      toolCallId: event.id,
      network: usedNetwork,
      // The call behind the card, so its next page is the same call with a token.
      input: input as JsonValue,
    })
    const record = withAccountNames(enrichResultWithAbi(bridged, ctx.specCatalog), ctx.addressBook)
    const blocks: SectionBlock[] = []
    const pluginSchema = view === undefined && event.view ? PLUGIN_VIEWS[event.view] : undefined
    const pluginParse =
      pluginSchema && record.state === 'success' ? pluginSchema.safeParse(record.data) : undefined
    const table =
      event.view === 'table' && record.state === 'success' ? tableModel(record.data) : undefined
    if (pluginParse?.success) {
      blocks.push({
        kind: 'plugin',
        view: event.view!,
        data: pluginParse.data,
        network: usedNetwork,
      })
    } else if (table) {
      blocks.push({ kind: 'table', title: event.toolName, ...table })
    } else if (view === undefined) {
      const text = JSON.stringify(record.state === 'success' ? record.data : record.error, null, 2)
      blocks.push({ kind: 'raw', title: event.toolName, text })
    } else {
      blocks.push({ kind: 'view', view: viewFor(record, view) })
      // The program's first page also carries its call surface.
      const program =
        record.state === 'success'
          ? (record.data as {
              fromLine?: number
              program?: string
              analysis?: { entrypoints?: string[] }
            })
          : undefined
      if (
        view === 'application.program' &&
        program?.fromLine === 1 &&
        program.program === 'approval' &&
        program.analysis?.entrypoints?.length
      ) {
        blocks.push({ kind: 'view', view: viewFor(record, 'application.methods') })
      }
    }
    // A raw card where a real one was promised is a bug somewhere; name it.
    const pluginIssue =
      pluginParse && !pluginParse.success ? pluginParse.error.issues[0] : undefined
    const note = degraded
      ? `${event.toolName} declared ${degraded.view} but its result didn't parse (${degraded.reason}) — shown raw.`
      : pluginIssue
        ? `${event.toolName} declared ${event.view} but its result didn't parse (${pluginIssue.path.map(String).join('.') || '(root)'}: ${pluginIssue.message}) — shown raw.`
        : undefined
    return { usedNetwork, kind: 'cards', record, blocks, ...(note ? { note } : {}) }
  } catch (error: unknown) {
    // Say so: a silently dropped result looks like the agent said nothing.
    return {
      usedNetwork,
      kind: 'dropped',
      message: `Dropped a malformed result from ${event.toolName} — ${error instanceof Error ? shorten(error.message, 100) : 'unknown error'}`,
    }
  }
}

/** Renderer callbacks for one agent turn. */
export interface AgentTurnHandlers {
  onText(delta: string): void
  onReasoning?(delta: string): void
  onToolCall(toolName: string): void
  onToolResult(event: Extract<AgentEvent, { type: 'tool-result' }>): void
  onError(message: string): void
}

/** Pumps one user turn through the session, dispatching the app's callbacks. */
export async function runAgentTurn(
  session: AgentSession,
  input: string,
  handlers: AgentTurnHandlers,
): Promise<void> {
  for await (const event of session.stream(input)) {
    switch (event.type) {
      case 'text-delta':
        handlers.onText(event.text)
        break
      case 'reasoning-delta':
        handlers.onReasoning?.(event.text)
        break
      case 'tool-call':
        handlers.onToolCall(event.toolName)
        break
      case 'tool-result':
        handlers.onToolResult(event)
        break
      case 'error':
        handlers.onError(event.message)
        break
      default:
        break
    }
  }
}

/** Where a tool-result plan lands; the hook wires these to the feed, the store, and the write flow. */
export interface PlanSinks {
  addRecord: (record: StructuredResult) => void
  appendBlock: (block: SectionBlock) => void
  appendNote: (text: string, tone: 'muted' | 'error') => void
  startFromDraft: (draftRecord: StructuredResult) => void
}

/** Lands one planned tool result: a write goes to approval, cards to the feed, a drop to a note. */
export function applyToolResultPlan(plan: ToolResultPlan, sinks: PlanSinks): void {
  switch (plan.kind) {
    case 'write':
      sinks.startFromDraft(plan.draftRecord)
      return
    case 'cards':
      sinks.addRecord(plan.record)
      for (const block of plan.blocks) sinks.appendBlock(block)
      if (plan.note) sinks.appendNote(plan.note, 'error')
      return
    case 'dropped':
      sinks.appendNote(plan.message, 'error')
  }
}

/**
 * The approval gate for get_application_program: the one expensive read.
 * Asks once per (network, app) with the cost lines, and remembers a yes so
 * further pages of the same program never ask again.
 */
export function programReadApproval(input: {
  sessionNetwork: () => LiveNetworkId
  agentConfig: Parameters<typeof programCostLines>[2]
  askConfirm: (title: string, lines: string[]) => Promise<boolean>
  approved: Set<string>
}): NonNullable<ExplorerAgentOptions['approveToolCall']> {
  return async ({ toolName, input: args }) => {
    if (toolName !== 'get_application_program') return true
    const { applicationId, network } = (args ?? {}) as { applicationId?: number; network?: string }
    const target = networkOfCall({ network }, input.sessionNetwork())
    const key = `${target}:${applicationId}`
    if (input.approved.has(key)) return true
    const lines = await programCostLines(applicationId, target, input.agentConfig)
    const ok = await input.askConfirm('EXPLAIN THIS CONTRACT?', lines)
    if (ok) input.approved.add(key)
    return ok
  }
}
