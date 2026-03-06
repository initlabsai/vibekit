'use client'

import type { Message } from 'ai'
import { ToolResult } from './tool-result'
import { User, Bot } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'

interface ChatMessageProps {
  message: Message
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex gap-3 ${isUser ? 'justify-end' : ''}`}>
      {!isUser && (
        <Avatar size="sm" className="mt-1 bg-algo-teal/20">
          <AvatarFallback className="bg-algo-teal/20">
            <Bot className="w-3.5 h-3.5 text-algo-teal" />
          </AvatarFallback>
        </Avatar>
      )}
      <div className={`max-w-[85%] space-y-2 ${isUser ? 'order-first' : ''}`}>
        {message.parts?.map((part, i) => {
          if (part.type === 'text' && part.text) {
            return (
              <div
                key={i}
                className={`rounded-lg px-4 py-2 text-sm ${
                  isUser
                    ? 'bg-algo-teal text-algo-dark'
                    : 'text-algo-text'
                }`}
              >
                {part.text}
              </div>
            )
          }
          if (part.type === 'tool-invocation') {
            if (part.toolInvocation.state === 'result') {
              return (
                <ToolResult
                  key={i}
                  toolName={part.toolInvocation.toolName}
                  result={part.toolInvocation.result}
                />
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
          <div
            className={`rounded-lg px-4 py-2 text-sm ${
              isUser ? 'bg-algo-teal text-algo-dark' : 'text-algo-text'
            }`}
          >
            {message.content}
          </div>
        )}
      </div>
      {isUser && (
        <Avatar size="sm" className="mt-1">
          <AvatarFallback className="bg-algo-border">
            <User className="w-3.5 h-3.5 text-algo-muted" />
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  )
}
