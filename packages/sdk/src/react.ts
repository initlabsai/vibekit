import type { ReactNode } from 'react'
import type { UIMessage } from 'ai'
import { isToolUIPart, getToolName } from 'ai'
import type { ToolOutputMap } from './types'

type MessagePart = UIMessage['parts'][number]
type AnyToolPart = Extract<MessagePart, { state: string }>

type HandlerData<K extends string> = K extends keyof ToolOutputMap ? ToolOutputMap[K] : unknown

export interface RenderToolPartsOptions {
  loading?: (toolName: string) => ReactNode
  fallback?: (toolName: string, data: unknown) => ReactNode
}

/**
 * Filters tool-UI parts from a message and renders them via typed handlers.
 *
 * Tool names are inferred from the `as const` tool array so missing handlers
 * are a type error and handler arguments autocomplete. For tools listed in
 * `ToolOutputMap`, the `data` parameter is fully typed.
 */
export function renderToolParts<const T extends readonly string[]>(
  _tools: T,
  parts: MessagePart[],
  handlers: { [K in T[number]]: (data: HandlerData<K>) => ReactNode },
  options?: RenderToolPartsOptions,
): ReactNode[] {
  const result: ReactNode[] = []

  for (const part of parts) {
    if (!isToolUIPart(part)) continue

    const toolName = getToolName(part) as T[number]
    const toolPart = part as AnyToolPart

    if (toolPart.state !== 'output-available') {
      if (options?.loading) {
        result.push(options.loading(toolName))
      }
      continue
    }

    const handler = handlers[toolName]
    if (handler) {
      result.push((handler as (data: unknown) => ReactNode)(toolPart.output))
    } else if (options?.fallback) {
      result.push(options.fallback(toolName, toolPart.output))
    }
  }

  return result
}
