'use client'

import type { Message } from 'ai'
import { ToolResult } from './tool-result'
import { User, Bot } from 'lucide-react'

interface ChatMessageProps {
  message: Message
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex gap-3 ${isUser ? 'justify-end' : ''}`}>
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-algo-teal/20 flex items-center justify-center shrink-0 mt-1">
          <Bot className="w-4 h-4 text-algo-teal" />
        </div>
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
            // Loading state
            return (
              <div
                key={i}
                className="rounded-lg border border-algo-border bg-algo-card p-4 animate-pulse"
              >
                <div className="h-3 bg-algo-border rounded w-1/3 mb-2" />
                <div className="h-3 bg-algo-border rounded w-2/3" />
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
        <div className="w-7 h-7 rounded-full bg-algo-border flex items-center justify-center shrink-0 mt-1">
          <User className="w-4 h-4 text-algo-muted" />
        </div>
      )}
    </div>
  )
}
