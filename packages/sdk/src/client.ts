import { DefaultChatTransport, type UIMessage } from 'ai'
import { VibeKitError, AuthError, RateLimitError } from './errors'
import type {
  VibeKitConfig,
  ChatOptions,
  QueryOptions,
  QueryResult,
  StreamEvent,
} from './types'

const DEFAULT_BASE_URL = 'https://api.getvibekit.ai'

export class VibeKit {
  private readonly apiKey: string
  private readonly baseUrl: string

  constructor(config: VibeKitConfig) {
    this.apiKey = config.apiKey
    this.baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '')
  }

  /**
   * Returns a `DefaultChatTransport` for use with `useChat()` from `@ai-sdk/react`.
   */
  chat(options?: ChatOptions): DefaultChatTransport<UIMessage> {
    const body: Record<string, unknown> = {}
    if (options?.systemPrompt) body.systemPrompt = options.systemPrompt
    if (options?.tools) body.tools = options.tools

    return new DefaultChatTransport({
      api: `${this.baseUrl}/chat`,
      headers: { Authorization: `Bearer ${this.apiKey}` },
      body,
    })
  }

  /**
   * One-shot query returning a parsed JSON result.
   */
  async query(query: string, options?: QueryOptions): Promise<QueryResult> {
    const body: Record<string, unknown> = { query }
    if (options?.tools) body.tools = options.tools
    if (options?.systemPrompt) body.systemPrompt = options.systemPrompt

    const res = await fetch(`${this.baseUrl}/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: options?.signal,
    })

    if (!res.ok) throw this.toError(res)

    return (await res.json()) as QueryResult
  }

  /**
   * Streaming query returning an async iterable of NDJSON events.
   */
  async *queryStream(
    query: string,
    options?: QueryOptions
  ): AsyncIterable<StreamEvent> {
    const body: Record<string, unknown> = { query }
    if (options?.tools) body.tools = options.tools
    if (options?.systemPrompt) body.systemPrompt = options.systemPrompt

    const res = await fetch(`${this.baseUrl}/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: options?.signal,
    })

    if (!res.ok) throw this.toError(res)

    const reader = res.body?.getReader()
    if (!reader) return

    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) continue
        yield JSON.parse(trimmed) as StreamEvent
      }
    }

    if (buffer.trim()) {
      yield JSON.parse(buffer.trim()) as StreamEvent
    }
  }

  private toError(res: Response): VibeKitError {
    if (res.status === 401) return new AuthError()
    if (res.status === 429) {
      const retry = res.headers.get('retry-after')
      return new RateLimitError(retry ? Number(retry) : null)
    }
    return new VibeKitError(res.statusText || 'Request failed', res.status)
  }
}
