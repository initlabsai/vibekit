'use client'

import type { Message } from 'ai'
import { ToolResult } from './tool-result'
import { Markdown } from './markdown'
import { User } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'

interface ChatMessageProps {
  message: Message
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user'
  const hasToolInvocations = message.parts?.some(
    (p) => p.type === 'tool-invocation',
  )

  if (isUser) {
    return (
      <div className="flex gap-3 justify-end">
        <div className="max-w-[85%]">
          <div className="rounded-lg bg-algo-teal px-4 py-2 text-sm text-algo-dark">
            {message.parts?.map((part, i) =>
              part.type === 'text' && part.text ? (
                <span key={i}>{part.text}</span>
              ) : null,
            ) ??
              message.content}
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
    <div className="space-y-2">
      {message.parts?.map((part, i) => {
        if (part.type === 'text' && part.text) {
          return (
            <div
              key={i}
              className={`animate-in fade-in duration-200 rounded-lg px-4 py-2 ${
                hasToolInvocations
                  ? 'text-xs text-algo-muted'
                  : 'text-sm text-algo-text/90'
              }`}
            >
              <Markdown>{part.text}</Markdown>
            </div>
          )
        }
        if (part.type === 'tool-invocation') {
          if (part.toolInvocation.state === 'result') {
            return (
              <div
                key={i}
                className="animate-in fade-in slide-in-from-bottom-2 duration-300"
              >
                <ToolResult
                  toolName={part.toolInvocation.toolName}
                  result={part.toolInvocation.result}
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
      {/* Fallback for messages without parts */}
      {!message.parts?.length && message.content && (
        <div className="animate-in fade-in duration-200 rounded-lg px-4 py-2 text-sm text-algo-text/90">
          <Markdown>{message.content}</Markdown>
        </div>
      )}
      {/* Pulsing dot while waiting for assistant content */}
      {!message.parts?.some(
        (p) => (p.type === 'text' && p.text) || p.type === 'tool-invocation',
      ) &&
        !message.content && (
          <div className="rounded-lg px-4 py-3">
            <div className="w-2 h-2 rounded-full bg-algo-teal animate-pulse" />
          </div>
        )}
    </div>
  )
}
