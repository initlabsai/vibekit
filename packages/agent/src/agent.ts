/**
 * The orchestrator: an LLM tool loop over ToolDefinition[] with a streaming
 * event protocol. The TUI runs it in-process; the hosted API wraps it.
 *
 * Deployment semantics (registry validation, pooled per-network contexts,
 * network-param injection) come from @initlabs/vibekit-core and are identical
 * to the MCP server's.
 */

import {
  executeToolCall,
  injectNetworkParam,
  resolveDeployment,
  ToolError,
  type AnyTool,
  type DeploymentOptions,
} from '@initlabs/vibekit-core'
import {
  stepCountIs,
  streamText,
  tool as aiTool,
  type LanguageModel,
  type ModelMessage,
  type ToolSet,
} from 'ai'

import { isToolErrorOutput, type AgentEvent, type ToolErrorOutput } from './events.js'
import { createModel, isProviderConfig, type ProviderConfig } from './provider.js'
import { defaultSystemPrompt } from './system-prompt.js'

export interface VibekitAgentOptions extends DeploymentOptions {
  /** BYOM: a provider config or any AI SDK LanguageModel instance. */
  model: LanguageModel | ProviderConfig
  /** Replaces the built-in system prompt entirely when set. */
  systemPrompt?: string
  /** Host-specific lines appended to the (default or custom) system prompt. */
  extraInstructions?: string
  /** Max model↔tool round trips per user turn. */
  maxSteps?: number
  /**
   * Human-in-the-loop gate for `requiresSigner`/`mutatesState`/`expensive` tools: called
   * before the handler runs; return false to deny (the model sees a DENIED error
   * result and the loop continues). Other read tools are never gated.
   */
  approveToolCall?: (call: { toolName: string; input: unknown }) => Promise<boolean>
}

export interface AgentSession {
  /**
   * Send one user message; yields AgentEvents as the model streams.
   * The session appends the exchange to its in-memory history — the
   * conversation is the only stateful thing here, owned by the caller's
   * process. No shared mutable store.
   */
  stream(input: string): AsyncIterable<AgentEvent>
  /** Conversation history (read-only view; reset() clears it). */
  readonly messages: readonly ModelMessage[]
  reset(): void
}

const DEFAULT_MAX_STEPS = 12

function toToolErrorOutput(err: unknown): ToolErrorOutput {
  if (err instanceof ToolError) {
    return { error: { code: err.code, message: err.message } }
  }
  // Some SDKs reject with plain objects; take their message before falling back to String().
  const message = (err as { message?: unknown } | null)?.message
  return {
    error: { code: 'TOOL_ERROR', message: typeof message === 'string' ? message : String(err) },
  }
}

export function createAgent(options: VibekitAgentOptions): AgentSession {
  const deployment = resolveDeployment(options)
  const model = isProviderConfig(options.model) ? createModel(options.model) : options.model
  const basePrompt = options.systemPrompt ?? defaultSystemPrompt(deployment)
  const system = options.extraInstructions
    ? `${basePrompt}\n\n${options.extraInstructions}`
    : basePrompt
  const maxSteps = options.maxSteps ?? DEFAULT_MAX_STEPS

  const viewByTool = new Map<string, string | undefined>(
    deployment.tools.map((tool: AnyTool) => [tool.name, tool.view]),
  )

  // ToolDefinition[] → AI SDK ToolSet. Failures are returned to the model as
  // an error payload (never thrown) so the loop continues and it can react.
  const toolSet: ToolSet = {}
  for (const tool of deployment.tools) {
    toolSet[tool.name] = aiTool({
      description: tool.description,
      inputSchema: injectNetworkParam(tool, deployment),
      execute: async (args: unknown) => {
        try {
          if ((tool.requiresSigner || tool.mutatesState || tool.expensive) && options.approveToolCall) {
            const approved = await options.approveToolCall({ toolName: tool.name, input: args })
            if (!approved) {
              return {
                error: { code: 'DENIED', message: 'The user denied this request.' },
              } satisfies ToolErrorOutput
            }
          }
          return await executeToolCall(deployment, tool, args)
        } catch (err) {
          return toToolErrorOutput(err)
        }
      },
    })
  }

  const messages: ModelMessage[] = []

  async function* stream(input: string): AsyncIterable<AgentEvent> {
    messages.push({ role: 'user', content: input })

    const result = streamText({
      model,
      system,
      messages: [...messages],
      tools: toolSet,
      stopWhen: stepCountIs(maxSteps),
    })

    for await (const part of result.fullStream) {
      switch (part.type) {
        case 'text-delta':
          yield { type: 'text-delta', text: part.text }
          break
        case 'reasoning-delta':
          yield { type: 'reasoning-delta', text: part.text }
          break
        case 'tool-call':
          yield { type: 'tool-call', id: part.toolCallId, toolName: part.toolName, input: part.input }
          break
        case 'tool-result': {
          const output: unknown = part.output
          yield {
            type: 'tool-result',
            id: part.toolCallId,
            toolName: part.toolName,
            input: part.input,
            output,
            view: viewByTool.get(part.toolName),
            isError: isToolErrorOutput(output),
          }
          break
        }
        case 'tool-error':
          // execute() catches everything, so this only fires for failures
          // outside the handler (schema repair, aborts) — still surfaced.
          yield {
            type: 'tool-result',
            id: part.toolCallId,
            toolName: part.toolName,
            input: part.input,
            output: toToolErrorOutput(part.error),
            view: viewByTool.get(part.toolName),
            isError: true,
          }
          break
        case 'error':
          yield {
            type: 'error',
            message: part.error instanceof Error ? part.error.message : String(part.error),
          }
          break
        case 'finish':
          yield {
            type: 'finish',
            finishReason: part.finishReason,
            usage: {
              inputTokens: part.totalUsage?.inputTokens,
              outputTokens: part.totalUsage?.outputTokens,
            },
          }
          break
        default:
          break
      }
    }

    messages.push(...(await result.responseMessages))
  }

  return {
    stream,
    get messages(): readonly ModelMessage[] {
      return messages
    },
    reset(): void {
      messages.length = 0
    },
  }
}
