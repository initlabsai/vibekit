'use client'

import type { UIMessage } from 'ai'
import { isToolUIPart, getToolName } from 'ai'
import { ToolResult } from './tool-result'
import { Markdown } from './markdown'
import { User, Bot } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { TypingDots } from './typing-dots'

interface ChatMessageProps {
  message: UIMessage
  onLoadMore?: (toolName: string, nextToken: string) => void
  isLoading?: boolean
}

type MessagePart = UIMessage['parts'][number]

/** Tool parts that have been checked via isToolUIPart — may include dynamic tools. */
type AnyToolPart = Extract<MessagePart, { state: string }>

interface ToolGroup {
  kind: 'tool-group'
  toolName: string
  parts: AnyToolPart[]
}

function toolDisplayName(toolName: string): string {
  // Strip any "mcp-server_" or similar prefix to get the bare tool name
  const bare = toolName.includes('-') ? toolName.split('-').pop()! : toolName
  const words = bare.split('_')
  const verb = words[0]
  const rest = words.slice(1).join(' ')

  if (verb === 'lookup' || verb === 'get') {
    return `Looking up ${rest}…`
  }
  if (verb === 'search') {
    return `Searching ${rest}…`
  }
  // Capitalize first letter and add ellipsis
  const label = bare.replace(/_/g, ' ')
  return label.charAt(0).toUpperCase() + label.slice(1) + '…'
}

function isToolGroup(item: unknown): item is ToolGroup {
  return (
    typeof item === 'object' &&
    item !== null &&
    'kind' in item &&
    (item as ToolGroup).kind === 'tool-group'
  )
}

/**
 * Groups consecutive same-tool parts into a single render unit for merged display.
 * Text parts and different-tool calls break the chain. Structural parts like
 * step-start boundaries are skipped (they render as null anyway).
 */
function groupParts(parts: MessagePart[]): (MessagePart | ToolGroup)[] {
  const result: (MessagePart | ToolGroup)[] = []

  for (const part of parts) {
    if (isToolUIPart(part)) {
      const toolName = getToolName(part)
      const lastGroup = findLastToolGroup(result)
      if (lastGroup && lastGroup.toolName === toolName) {
        lastGroup.parts.push(part)
      } else {
        result.push({ kind: 'tool-group', toolName, parts: [part] })
      }
    } else if (part.type === 'text' && part.text) {
      result.push(part)
    }
    // Skip structural parts (step-start, etc.) — they don't render
  }

  return result
}

/** Walk backwards to find the most recent tool group, stopping at text parts. */
function findLastToolGroup(items: (MessagePart | ToolGroup)[]): ToolGroup | null {
  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i]
    if (isToolGroup(item)) return item
    if ('type' in item && item.type === 'text') return null
  }
  return null
}

/**
 * Merges outputs from multiple paginated tool calls into a single result.
 * Arrays are concatenated, scalars use last-wins (e.g. nextToken from last page).
 */
function mergeToolOutputs(outputs: Record<string, unknown>[]): Record<string, unknown> {
  if (outputs.length === 1) return outputs[0]

  const merged: Record<string, unknown> = {}

  for (const output of outputs) {
    for (const [key, value] of Object.entries(output)) {
      if (Array.isArray(value) && Array.isArray(merged[key])) {
        merged[key] = [...(merged[key] as unknown[]), ...value]
      } else {
        merged[key] = value
      }
    }
  }

  return merged
}

export function ChatMessage({ message, onLoadMore, isLoading }: ChatMessageProps) {
  const isUser = message.role === 'user'
  const hasToolInvocations = message.parts?.some((p) => isToolUIPart(p))

  if (isUser) {
    return (
      <div className="flex gap-3 justify-end">
        <div className="max-w-[85%]">
          <div className="rounded-lg bg-algo-teal px-4 py-2 text-sm text-algo-dark">
            {message.parts?.map((part, i) =>
              part.type === 'text' && part.text ? <span key={i}>{part.text}</span> : null
            )}
          </div>
        </div>
        <Avatar size="sm" className="mt-1">
          <AvatarFallback className="bg-algo-border">
            <User className="w-3.5 h-3.5 text-algo-muted" />
          </AvatarFallback>
        </Avatar>
      </div>
    )
  }

  const grouped = groupParts(message.parts ?? [])

  // Assistant message
  return (
    <div className="flex gap-3">
      <Avatar size="sm" className="mt-1 shrink-0 hidden sm:flex">
        <AvatarFallback className="bg-algo-teal/10">
          <Bot className="w-3.5 h-3.5 text-algo-teal" />
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0 space-y-2">
        {grouped.map((item, i) => {
          if (isToolGroup(item)) {
            const group = item
            const readyParts = group.parts.filter((p) => p.state === 'output-available')
            const anyLoading = group.parts.some((p) => p.state !== 'output-available')

            if (readyParts.length === 0) {
              // All parts still loading — show skeleton
              return (
                <div
                  key={i}
                  className="rounded-lg border border-algo-border bg-algo-card p-4 space-y-2"
                >
                  <p className="text-xs text-algo-muted">{toolDisplayName(group.toolName)}</p>
                  <Skeleton className="h-3 w-1/3 bg-algo-border" />
                  <Skeleton className="h-3 w-2/3 bg-algo-border" />
                </div>
              )
            }

            const outputs = readyParts.map((p) => p.output as Record<string, unknown>)
            const merged = mergeToolOutputs(outputs)
            const nextToken = merged.nextToken as string | undefined

            return (
              <div key={i} className="overflow-hidden space-y-2">
                <ToolResult toolName={group.toolName} result={merged} />
                {anyLoading && (
                  <div className="rounded-lg border border-algo-border bg-algo-card p-4 space-y-2">
                    <p className="text-xs text-algo-muted">{toolDisplayName(group.toolName)}</p>
                    <Skeleton className="h-3 w-1/3 bg-algo-border" />
                    <Skeleton className="h-3 w-2/3 bg-algo-border" />
                  </div>
                )}
                {nextToken && !isLoading && onLoadMore && (
                  <button
                    onClick={() => onLoadMore(group.toolName, nextToken)}
                    className="text-xs text-algo-muted hover:text-algo-teal transition-colors cursor-pointer"
                  >
                    Load more results
                  </button>
                )}
              </div>
            )
          }

          const part = item as MessagePart
          if (part.type === 'text' && part.text) {
            return (
              <div
                key={i}
                className={`rounded-lg px-4 py-2 ${
                  hasToolInvocations ? 'text-sm text-algo-muted' : 'text-sm text-algo-text/90'
                }`}
              >
                <Markdown>{part.text}</Markdown>
              </div>
            )
          }
          return null
        })}
        {/* Typing indicator while waiting for assistant content */}
        {!message.parts?.some((p) => (p.type === 'text' && p.text) || isToolUIPart(p)) && (
          <div className="rounded-lg px-4 py-3">
            <TypingDots />
          </div>
        )}
      </div>
    </div>
  )
}
