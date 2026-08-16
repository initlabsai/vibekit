/**
 * The orchestrator: an LLM tool loop over ToolDefinition[] with a streaming
 * event protocol. One brain for every head (docs/DESIGN.md §9) — the TUI runs
 * it in-process, the hosted API wraps it behind Hono.
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
  type DisplayHint,
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
  /** Max model↔tool round trips per user turn. */
  maxSteps?: number
}

export interface AgentSession {
  /**
   * Send one user message; yields AgentEvents as the model streams.
   * The session appends the exchange to its in-memory history — the
   * conversation is the only stateful thing here, owned by the caller's
   * process (§10: no shared mutable store).
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
  return {
    error: { code: 'TOOL_ERROR', message: err instanceof Error ? err.message : String(err) },
  }
}

export function createAgent(options: VibekitAgentOptions): AgentSession {
  const deployment = resolveDeployment(options)
  const model = isProviderConfig(options.model) ? createModel(options.model) : options.model
  const system = options.systemPrompt ?? defaultSystemPrompt(deployment)
  const maxSteps = options.maxSteps ?? DEFAULT_MAX_STEPS

  const displayByTool = new Map<string, DisplayHint | undefined>(
    deployment.tools.map((tool: AnyTool) => [tool.name, tool.display]),
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
            output,
            display: displayByTool.get(part.toolName),
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
            output: toToolErrorOutput(part.error),
            display: displayByTool.get(part.toolName),
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
