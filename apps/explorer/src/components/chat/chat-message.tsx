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
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user'
  const hasToolInvocations = message.parts?.some((p) => isToolUIPart(p))

  if (isUser) {
    return (
      <div className="flex gap-3 justify-end">
        <div className="max-w-[85%]">
          <div className="rounded-lg bg-algo-teal px-4 py-2 text-sm text-algo-dark">
            {message.parts?.map((part, i) =>
              part.type === 'text' && part.text ? (
                <span key={i}>{part.text}</span>
              ) : null,
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

  // Assistant message
  return (
    <div className="flex gap-3">
      <Avatar size="sm" className="mt-1 shrink-0 hidden sm:flex">
        <AvatarFallback className="bg-algo-teal/10">
          <Bot className="w-3.5 h-3.5 text-algo-teal" />
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0 space-y-2">
        {message.parts?.map((part, i) => {
          if (part.type === 'text' && part.text) {
            return (
              <div
                key={i}
                className={`rounded-lg px-4 py-2 ${
                  hasToolInvocations
                    ? 'text-xs text-algo-muted'
                    : 'text-sm text-algo-text/90'
                }`}
              >
                <Markdown>{part.text}</Markdown>
              </div>
            )
          }
          if (isToolUIPart(part)) {
            if (part.state === 'output-available') {
              return (
                <div key={i} className="overflow-hidden">
                  <ToolResult
                    toolName={getToolName(part)}
                    result={part.output}
                  />
                </div>
              )
            }
            return (
              <div
                key={i}
                className="rounded-lg border border-algo-border bg-algo-card p-4 space-y-2"
              >
                <Skeleton className="h-3 w-1/3 bg-algo-border" />
                <Skeleton className="h-3 w-2/3 bg-algo-border" />
              </div>
            )
          }
          return null
        })}
        {/* Typing indicator while waiting for assistant content */}
        {!message.parts?.some(
          (p) => (p.type === 'text' && p.text) || isToolUIPart(p),
        ) && (
          <div className="rounded-lg px-4 py-3">
            <TypingDots />
          </div>
        )}
      </div>
    </div>
  )
}
