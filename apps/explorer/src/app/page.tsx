'use client'

import { useChat } from '@ai-sdk/react'
import { ChatMessage } from '@/components/chat/chat-message'
import { ChatInput } from '@/components/chat/chat-input'
import { Search } from 'lucide-react'
import { useRef, useEffect } from 'react'

const SUGGESTIONS = [
  'Show me the latest block',
  'Look up USDC asset info',
  'Show me recent application calls',
  'Look up the account gabe.algo',
  'Resolve the NFD gabe.algo',
]

export default function Home() {
  const { messages, input, setInput, handleSubmit, isLoading, error, append } = useChat()
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  const hasMessages = messages.length > 0

  if (!hasMessages) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-4">
        <div className="max-w-2xl w-full space-y-8">
          <div className="text-center space-y-3">
            <h1 className="text-4xl font-bold text-algo-teal">Algorand Explorer</h1>
            <p className="text-algo-muted">
              AI-powered blockchain explorer. Ask about accounts, transactions, assets, and more.
            </p>
          </div>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-algo-muted" />
            <ChatInput
              input={input}
              setInput={setInput}
              onSubmit={handleSubmit}
              isLoading={isLoading}
              placeholder="Search the Algorand blockchain..."
            />
          </div>
          <div className="flex flex-wrap gap-2 justify-center">
            {SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => append({ role: 'user', content: suggestion })}
                className="px-3 py-1.5 text-xs rounded-full border border-algo-border text-algo-muted hover:border-algo-teal hover:text-algo-teal transition-colors"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen">
      <header className="border-b border-algo-border px-4 py-3">
        <h1 className="text-sm font-semibold text-algo-teal">Algorand Explorer</h1>
      </header>
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
        <div className="max-w-3xl mx-auto space-y-6">
          {messages.map((message) => (
            <ChatMessage key={message.id} message={message} />
          ))}
          {isLoading && messages[messages.length - 1]?.role === 'user' && (
            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-full bg-algo-teal/20 flex items-center justify-center shrink-0">
                <div className="w-2 h-2 rounded-full bg-algo-teal animate-pulse" />
              </div>
              <div className="rounded-lg border border-algo-border bg-algo-card p-4 animate-pulse">
                <div className="h-3 bg-algo-border rounded w-48" />
              </div>
            </div>
          )}
          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              <p className="font-medium">Something went wrong</p>
              <p className="text-red-400/70 mt-1">{error.message}</p>
            </div>
          )}
        </div>
      </div>
      <div className="border-t border-algo-border px-4 py-4">
        <div className="max-w-3xl mx-auto">
          <ChatInput
            input={input}
            setInput={setInput}
            onSubmit={handleSubmit}
            isLoading={isLoading}
          />
        </div>
      </div>
    </div>
  )
}
